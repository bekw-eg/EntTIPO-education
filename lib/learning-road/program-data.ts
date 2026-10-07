import { Prisma, type ExamSession } from "@prisma/client";
import { readUserSkills } from "../skillProgress";
import { localDay, nextReview, studentTimeZone } from "../learningPolicy";
import { SKILL_PREREQUISITES } from "./graph";
import { PREPARATION_POLICY, assessSkills, orderProgramSkills, type PreparationPolicy } from "./program-policy";
import type { PaperQuestion, gradeExamQuestion } from "../exam/mode";

export const programInclude = { nodes: { orderBy: { position: "asc" as const }, include: { skill: true,
  assessments: { orderBy: { startedAt: "asc" as const }, select: { id: true, status: true, result: true, startedAt: true, completedAt: true } } } } };
export type Program = Prisma.LearningRoadBlockGetPayload<{ include: typeof programInclude }>;
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function createProgramCycle(tx: Prisma.TransactionClient, userId: string, diagnosticId: string,
  gapSkillIds?: string[], sourceExamId?: string) {
  const skills = await readUserSkills(tx, userId), reviews = await tx.skillReview.findMany({ where: { userId } });
  const selected = new Set(gapSkillIds ?? skills.map(s => s.id));
  // Existing confirmed foundations stay confirmed in a reinforcement cycle.
  const prior = await tx.learningRoadNode.findMany({ where: { block: { userId, programVersion: { gt: 0 } }, type: "SKILL", completedAt: { not: null } }, select: { skillId: true } });
  const confirmed = new Set(prior.map(n => n.skillId));
  function addDependencies(id: string, visiting = new Set<string>()) {
    if (visiting.has(id)) throw new Error("Cyclic preparation prerequisites");
    visiting.add(id);
    for (const prerequisite of SKILL_PREREQUISITES[id] ?? []) if (skills.some(s => s.id === prerequisite) && !confirmed.has(prerequisite)) {
      selected.add(prerequisite); addDependencies(prerequisite, new Set(visiting));
    }
  }
  [...selected].forEach(id => addDependencies(id));
  const ordered = orderProgramSkills(skills.filter(s => selected.has(s.id)).map(s => ({ id: s.id, state: s.state,
    failures: s.recentFailureCount, due: reviews.some(r => r.skillId === s.id && r.dueDay <= localDay(new Date(), r.timeZone)) })), SKILL_PREREQUISITES);
  if (!ordered.length) return null;
  const policy = PREPARATION_POLICY;
  const specs: Prisma.LearningRoadNodeCreateWithoutBlockInput[] = [];
  let group: string[] = [], previous: string[] = [];
  const addMixed = () => {
    const skillIds = [...new Set([...group, ...previous.slice(-policy.priorSkillsInMixed)])];
    specs.push({ key: `mixed:${specs.length}`, position: specs.length, type: "MIXED", skill: { connect: { id: skillIds[0] } },
      skillIds, reason: "mixed_review", questionCount: policy.mixedPerSkill * skillIds.length,
      estimatedMinutes: policy.mixedPerSkill * skillIds.length * 2 });
    previous.push(...group); group = [];
  };
  for (const skill of ordered) {
    const credit = !gapSkillIds && skill.state === "mastered" && !skill.due;
    const reason = gapSkillIds?.includes(skill.id) ? "final_gap" : skill.due ? "due_review" : skill.failures > 0 ? "observed_difficulty" : skill.state === "insufficient" ? "insufficient" : "confirmation";
    specs.push({ key: `skill:${skill.id}`, position: specs.length, type: "SKILL", skill: { connect: { id: skill.id } }, skillIds: [skill.id],
      reason, prerequisiteIds: (SKILL_PREREQUISITES[skill.id] ?? []).filter(id => skills.some(s => s.id === id)),
      questionCount: policy.blockSize, estimatedMinutes: policy.blockSize * 2,
      ...(credit ? { completedAt: new Date(), evidence: json({ source: "existing_mastery", state: "mastered", passed: true }) } : {}),
      ...(gapSkillIds?.includes(skill.id) ? { phase: "repair", repairSkillIds: [skill.id] } : {}) });
    group.push(skill.id);
    if (group.length === policy.mixedEvery) addMixed();
  }
  if (group.length) addMixed();
  specs.push({ key: "final", position: specs.length, type: "FINAL", skill: { connect: { id: ordered[0].id } },
    skillIds: ordered.map(s => s.id), reason: "final", questionCount: 20, estimatedMinutes: policy.finalMinutes });
  const last = await tx.learningRoadBlock.findFirst({ where: { userId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
  return tx.learningRoadBlock.create({ data: { userId, diagnosticId, sourceExamId, sequence: (last?.sequence ?? 0) + 1,
    programVersion: policy.version, policy: json(policy), reason: gapSkillIds ? "final_gaps" : "initial", nodes: { create: specs } }, include: programInclude });
}

/** Caller holds the account row lock. Never rewrite a started program on ordinary reads. */
export async function ensureProgram(tx: Prisma.TransactionClient, userId: string) {
  const existing = await tx.learningRoadBlock.findFirst({ where: { userId, programVersion: { gt: 0 } }, orderBy: { sequence: "desc" }, include: programInclude });
  if (existing) return existing;
  const diagnostic = await tx.diagnosticSession.findFirst({ where: { userId, status: "completed" }, orderBy: { completedAt: "desc" } });
  return diagnostic ? createProgramCycle(tx, userId, diagnostic.id) : null;
}

export async function reconcileProgramPractice(tx: Prisma.TransactionClient, program: Program) {
  for (const node of program.nodes) {
    if (node.completedAt || node.phase !== "practice" || !node.sessionId) continue;
    const session = await tx.practiceSession.findFirst({ where: { id: node.sessionId, userId: program.userId },
      include: { attempts: { where: { userId: program.userId }, select: { questionId: true } } } });
    if (session?.questionIds.length && session.questionIds.every(id => session.attempts.some(a => a.questionId === id))) {
      // Offline/assisted attempts can finish the practice step, never the skill/checkpoint.
      await tx.learningRoadNode.update({ where: { id: node.id }, data: { phase: "check", unavailable: false } });
    }
  }
  return tx.learningRoadBlock.findUniqueOrThrow({ where: { id: program.id }, include: programInclude });
}

/** Called once in the same transaction as the authoritative exam result. */
export async function completeProgramAssessment(tx: Prisma.TransactionClient, exam: ExamSession, paper: PaperQuestion[],
  questions: ReturnType<typeof gradeExamQuestion>[], now: Date) {
  if (!exam.roadNodeId) return null;
  const node = await tx.learningRoadNode.findFirstOrThrow({ where: { id: exam.roadNodeId, block: { userId: exam.userId } }, include: { block: true } });
  const policy = node.block.policy as unknown as PreparationPolicy;
  const assessed = assessSkills(questions.map((q, i) => ({ skillIds: q.skillIds, isCorrect: q.isCorrect,
    independent: !paper[i].previouslyExposed })), node.skillIds, node.type === "SKILL" ? "SKILL" : "MIXED", policy);
  const final = node.type === "FINAL";
  const gapSkillIds = final ? [...new Set(questions.filter(q => !q.isCorrect).flatMap(q => q.skillIds))] : assessed.gapSkillIds;
  const passed = final ? questions.filter(q => q.isCorrect).length / questions.length >= policy.finalPassRatio : assessed.passed;
  const outcome = { passed, gapSkillIds, skills: assessed.skills, source: "assessment", examId: exam.id,
    next: final ? gapSkillIds.length ? "reinforcement" : "completed" : passed ? "continue" : "repair" };
  await tx.learningRoadNode.update({ where: { id: node.id }, data: { evidence: json(outcome), unavailable: false,
    completedAt: passed || final ? now : null, phase: passed || final ? "check" : "repair",
    repairSkillIds: passed ? [] : gapSkillIds, sessionId: null } });
  const user = await tx.user.findUniqueOrThrow({ where: { id: exam.userId }, select: { timeZone: true } });
  for (const skillId of new Set(final ? paper.flatMap(q => q.skillIds) : node.skillIds)) {
    const prior = await tx.skillReview.findUnique({ where: { userId_skillId: { userId: exam.userId, skillId } } });
    const schedule = nextReview(now, studentTimeZone(user.timeZone), prior?.intervalIndex ?? 0, !gapSkillIds.includes(skillId), !prior);
    await tx.skillReview.upsert({ where: { userId_skillId: { userId: exam.userId, skillId } },
      create: { userId: exam.userId, skillId, ...schedule }, update: { ...schedule, version: { increment: 1 } } });
  }
  if (node.type === "MIXED" && gapSkillIds.length) {
    // Milestone adjustment only: preserve completed work and record why pending work changed.
    await tx.learningRoadNode.updateMany({ where: { blockId: node.blockId, completedAt: null, position: { gt: node.position },
      type: "SKILL", OR: [{ skillId: { in: gapSkillIds } }, { prerequisiteIds: { hasSome: gapSkillIds } }] },
    data: { reason: "checkpoint_gap" } });
  }
  if (final) {
    await tx.learningRoadBlock.update({ where: { id: node.blockId }, data: { status: gapSkillIds.length ? "reinforcement" : "completed" } });
    if (gapSkillIds.length) await createProgramCycle(tx, exam.userId, node.block.diagnosticId!, gapSkillIds, exam.id);
  }
  return outcome;
}
