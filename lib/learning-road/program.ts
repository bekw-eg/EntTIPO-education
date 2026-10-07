import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { lockAccount, PracticeError } from "../practiceStorage";
import { assertNoActiveExam } from "../exam/guard";
import { prepareExam, examServerNow } from "../exam/session";
import { TIPO_MATH } from "../exam/profile";
import { choiceSchema, makeChoiceSnapshots } from "../practiceChoice";
import { ensureProgram, reconcileProgramPractice, json, type Program } from "./program-data";
import { prepareControl, contentKey } from "./program-bank";
import type { PreparationPolicy } from "./program-policy";

const options = { maxWait: 15000, timeout: 30000 };
export async function getPreparation(userId: string) {
  return prisma.$transaction(async tx => {
    await lockAccount(tx, userId);
    const [diagnostic, activeExam] = await Promise.all([
      tx.diagnosticSession.findFirst({ where: { userId }, orderBy: { startedAt: "desc" }, select: { id: true, status: true } }),
      tx.examSession.findFirst({ where: { userId, status: "active" }, select: { id: true } }),
    ]);
    let program = await ensureProgram(tx, userId);
    if (program) program = await reconcileProgramPractice(tx, program);
    const nodes = program?.nodes ?? [], current = nodes.find(n => !n.completedAt);
    const past = await tx.learningRoadBlock.findMany({ where: { userId, programVersion: { gt: 0 } }, orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, reason: true, status: true, sourceExamId: true, nodes: { select: { skillId: true, type: true, completedAt: true } } } });
    const confirmed = new Set(past.flatMap(b => b.nodes.filter(n => n.type === "SKILL" && n.completedAt).map(n => n.skillId)));
    nodes.filter(n => n.type === "SKILL" && !n.completedAt).forEach(n => confirmed.delete(n.skillId));
    current?.repairSkillIds.forEach(id => confirmed.delete(id));
    const skills = await tx.skill.findMany({ orderBy: { id: "asc" }, select: { id: true, nameRu: true, nameKk: true } });
    const stage = activeExam ? "assessment_active" : diagnostic?.status === "active" ? "diagnostic_active" : !program ? diagnostic ? "content_shortage" : "diagnostic_needed"
      : program.status === "completed" ? "completed" : program.reason === "final_gaps" ? "reinforcement"
      : current?.unavailable ? "content_shortage" : current?.type === "FINAL" ? "final_ready" : current?.type === "MIXED" ? "mixed_ready"
      : nodes.some(n => n.assessments.length || n.sessionId) ? "learning" : "road_ready";
    const nextMixed = nodes.find(n => n.type === "MIXED" && !n.completedAt);
    return { id: program?.id ?? null, sequence: program?.sequence ?? 0, stage,
      diagnosticId: diagnostic?.id ?? null, activeExamId: activeExam?.id ?? null,
      policy: (program?.policy ?? null) as unknown as PreparationPolicy | null,
      confirmedSkillIds: [...confirmed], skills,
      totalSkills: new Set(past.flatMap(b => b.nodes.filter(n => n.type === "SKILL").map(n => n.skillId))).size,
      blocksToMixed: nextMixed ? nodes.filter(n => n.type === "SKILL" && !n.completedAt && n.position < nextMixed.position).length : 0,
      history: past.map(({ nodes: _nodes, ...cycle }) => cycle),
      nodes: nodes.map(n => ({ id: n.id, type: n.type, skillId: n.skillId, skillIds: n.skillIds,
        nameRu: n.skill.nameRu, nameKk: n.skill.nameKk, goalRu: n.skill.explanationRu, goalKk: n.skill.explanationKk,
        prerequisiteIds: n.prerequisiteIds, reason: n.reason, phase: n.phase,
        status: n.completedAt ? "confirmed" : current?.id === n.id ? "current" : "locked",
        unavailable: n.unavailable, questionCount: n.questionCount, estimatedMinutes: n.estimatedMinutes,
        repairSkillIds: n.repairSkillIds, sessionId: n.sessionId, evidence: n.evidence,
        assessments: n.assessments.map(a => ({ id: a.id, status: a.status, completedAt: a.completedAt,
          points: a.status === "completed" ? Number((a.result as Record<string, Prisma.JsonValue>)?.points) : null,
          maxPoints: a.status === "completed" ? Number((a.result as Record<string, Prisma.JsonValue>)?.maxPoints) : null })) })) };
  }, options);
}
export type PreparationView = Awaited<ReturnType<typeof getPreparation>>;

async function unavailable(tx: Prisma.TransactionClient, nodeId: string, shortages: unknown) {
  await tx.learningRoadNode.update({ where: { id: nodeId }, data: { unavailable: true } });
  return { unavailable: true as const, shortages };
}

async function startPractice(tx: Prisma.TransactionClient, program: Program, node: Program["nodes"][number], language: "ru" | "kk") {
  if (node.sessionId) return { href: `/practice/session/${node.sessionId}` };
  if (node.phase !== "repair") throw new PracticeError("preparation_check_first", 409);
  const policy = program.policy as unknown as PreparationPolicy;
  const skillIds = node.repairSkillIds.length ? node.repairSkillIds : node.skillIds;
  // Reserve independent questions before selecting practice. Failed/seen questions are useful for learning.
  const reserve = await prepareControl(tx, program.userId, node.skillIds, node.type === "SKILL" ? policy.blockSize : policy.mixedPerSkill, language);
  const reserved = new Set(reserve.paper?.map(q => q.id) ?? []);
  const pending = await tx.learningCheck.findMany({ where: { userId: program.userId, status: "pending" }, select: { questionId: true } });
  pending.forEach(c => reserved.add(c.questionId));
  const bank = await tx.question.findMany({ where: { purpose: { in: ["practice", "verification"] }, id: { notIn: [...reserved] },
    skills: { some: { skillId: { in: skillIds } } } }, orderBy: [{ difficulty: "asc" }, { id: "asc" }],
    include: { attempts: { where: { userId: program.userId }, select: { id: true } }, skills: true, steps: { include: { skills: true } } } });
  const previouslySeen = new Set((await tx.examSession.findMany({ where: { userId: program.userId, status: "completed" }, select: { questionIds: true } })).flatMap(e => e.questionIds));
  bank.sort((a, b) => Number(b.attempts.length > 0 || previouslySeen.has(b.id)) - Number(a.attempts.length > 0 || previouslySeen.has(a.id)));
  const selected: string[] = [], fingerprints = new Set<string>();
  for (const skillId of skillIds) {
    let count = 0;
    for (const q of bank) {
      const c = choiceSchema.safeParse(q.practiceChoice);
      if (!c.success || c.data.type !== "single" || !c.data.skillIds.includes(skillId) ||
        !q.skills.some(s => s.skillId === skillId) || !q.steps.some(s => s.skills.some(l => l.skillId === skillId)) ||
        language === "kk" && (!c.data.questionTextKk || !c.data.explanationKk || c.data.options.some(o => !o.textKk))) continue;
      if (selected.includes(q.id)) { count++; if (count === policy.practicePerSkill) break; continue; }
      const key = contentKey(c.data.questionText);
      if (fingerprints.has(key)) continue;
      selected.push(q.id); fingerprints.add(key); count++;
      if (count === policy.practicePerSkill) break;
    }
    if (count < policy.practicePerSkill) return unavailable(tx, node.id, [{ skillId, available: count, required: policy.practicePerSkill }]);
  }
  const session = await tx.practiceSession.create({ data: { userId: program.userId, mode: "mixed", questionIds: selected,
    totalCount: selected.length, choiceSnapshots: await makeChoiceSnapshots(tx, selected) } });
  await tx.learningRoadNode.update({ where: { id: node.id }, data: { sessionId: session.id, phase: "practice", unavailable: false } });
  return { href: `/practice/session/${session.id}` };
}

export async function runPreparation(userId: string, nodeId: string, action: "check" | "practice", requestId: string, language: "ru" | "kk") {
  return prisma.$transaction(async tx => {
    await lockAccount(tx, userId);
    const owned = await tx.learningRoadNode.findFirst({ where: { id: nodeId, block: { userId, programVersion: { gt: 0 } } } });
    if (!owned) throw new PracticeError("preparation_missing", 404);
    const startHash = createHash("sha256").update(JSON.stringify({ nodeId, language, action })).digest("hex");
    const replay = await tx.examSession.findUnique({ where: { userId_startRequestId: { userId, startRequestId: requestId } } });
    if (replay) {
      if (replay.roadNodeId !== nodeId || action !== "check" || replay.startHash !== startHash) throw new PracticeError("preparation_request_conflict", 409);
      return { href: `/exam/${replay.id}` };
    }
    const active = await tx.examSession.findFirst({ where: { userId, status: "active" } });
    if (active?.roadNodeId === nodeId && action === "check") return { href: `/exam/${active.id}` };
    await assertNoActiveExam(tx, userId);
    const initial = await ensureProgram(tx, userId);
    if (!initial || initial.id !== owned.blockId) throw new PracticeError("preparation_archived", 409);
    const program = await reconcileProgramPractice(tx, initial), node = program.nodes.find(n => n.id === nodeId)!;
    if (node.completedAt) return { href: node.assessments.length ? `/exam/${node.assessments.at(-1)!.id}` : "/learning-road" };
    if (program.nodes.find(n => !n.completedAt)?.id !== nodeId) throw new PracticeError("preparation_locked", 409);
    const confirmed = await tx.learningRoadNode.findMany({ where: { block: { userId, programVersion: { gt: 0 } }, type: "SKILL", completedAt: { not: null } }, select: { skillId: true } });
    if (node.prerequisiteIds.some(id => !confirmed.some(n => n.skillId === id))) throw new PracticeError("preparation_locked", 409);
    if (action === "practice") return startPractice(tx, program, node, language);
    if (node.phase !== "check") throw new PracticeError("preparation_practice_first", 409);
    const policy = program.policy as unknown as PreparationPolicy;
    const prepared = node.type === "FINAL" ? await prepareExam(tx, TIPO_MATH, userId, language)
      : await prepareControl(tx, userId, node.skillIds, node.type === "SKILL" ? policy.blockSize : policy.mixedPerSkill, language);
    if (!prepared.paper) return unavailable(tx, node.id, prepared.shortages);
    const profile = node.type === "FINAL" ? TIPO_MATH : { ...TIPO_MATH, id: "preparation-control", version: String(program.programVersion),
      title: "Preparation checkpoint", sources: [], points: [],
      official: { ...TIPO_MATH.official, questionCount: prepared.paper.length, maxPoints: prepared.paper.length } };
    const durationMinutes = node.type === "FINAL" ? policy.finalMinutes : prepared.paper.length * 2;
    const now = await examServerNow(tx);
    const exam = await tx.examSession.create({ data: { userId, roadNodeId: node.id, startRequestId: requestId,
      startHash,
      profileId: profile.id, profileVersion: profile.version, profileSnapshot: json(profile), language,
      paper: json(prepared.paper), questionIds: prepared.paper.map(q => q.id), startedAt: now,
      durationMinutes, deadlineAt: new Date(now.getTime() + durationMinutes * 60000) } });
    await tx.learningRoadNode.update({ where: { id: node.id }, data: { unavailable: false } });
    return { href: `/exam/${exam.id}` };
  }, options);
}
