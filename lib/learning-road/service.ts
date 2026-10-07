import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { lockAccount, PracticeError } from "../practiceStorage";
import { assertNoActiveExam } from "../exam/guard";
import { readUserSkills } from "../skillProgress";
import { localDay } from "../learningPolicy";
import { selectQuestionsForSession } from "../adaptive";
import { makeChoiceSnapshots } from "../practiceChoice";
import { similarQuestions, startLearningCheck } from "../learningChecks";
import { buildLearningRoad, roadStatuses } from "./builder";
import { skillGraph } from "./graph";
import type { LearningRoadView, RoadNodeType, RoadReason, RoadSkillState } from "./types";

const includeNodes = { nodes: { orderBy: { position: "asc" as const }, include: { skill: true } } };
type Block = Prisma.LearningRoadBlockGetPayload<{ include: typeof includeNodes }>;

async function learningState(tx: Prisma.TransactionClient, userId: string, now: Date) {
  const [skills, reviews, questions, mistakes, observations, diagnostic] = await Promise.all([
    readUserSkills(tx, userId), tx.skillReview.findMany({ where: { userId } }),
    tx.question.findMany({ where: { purpose: "practice", practiceChoice: { path: ["type"], equals: "single" } },
      select: { skills: { select: { skillId: true } } } }),
    tx.mistake.findMany({ where: { userId, attemptId: { not: null }, confirmedAt: null,
      createdAt: { gte: new Date(now.getTime() - 14 * 86400000) } }, select: { skillId: true } }),
    tx.skillObservation.findMany({ where: { userId, createdAt: { gte: new Date(now.getTime() - 14 * 86400000) } },
      select: { skillId: true, usedHint: true, isCorrect: true, diagnosticAnswerId: true } }),
    tx.diagnosticSession.findFirst({ where: { userId, status: "completed" }, orderBy: { completedAt: "desc" }, select: { id: true } }),
  ]);
  const state: RoadSkillState[] = skills.map(skill => {
    const review = reviews.find(item => item.skillId === skill.id);
    return { id: skill.id, state: skill.state, masteryScore: skill.masteryScore,
      distinctQuestions: skill.distinctQuestions, observationCount: skill.observationCount,
      daysSincePractice: skill.lastAttemptAt ? Math.max(0, Math.floor((now.getTime() - skill.lastAttemptAt.getTime()) / 86400000)) : 0,
      recentMistakes: mistakes.filter(item => item.skillId === skill.id).length,
      diagnosticFailures: observations.filter(item => item.skillId === skill.id && item.diagnosticAnswerId && !item.isCorrect).length,
      hints: observations.filter(item => item.skillId === skill.id && item.usedHint).length,
      due: !!review && localDay(now, review.timeZone) >= review.dueDay,
      practiceCount: questions.filter(question => question.skills.some(link => link.skillId === skill.id)).length };
  });
  return { state, skills, needsDiagnostic: !diagnostic, diagnosticId: diagnostic?.id ?? null };
}

/** Completion is reconciled from owned, server-graded attempts, never from a client flag.
 * Finishing a lesson records participation, not mastery or independent confirmation. */
async function syncBlock(tx: Prisma.TransactionClient, block: Block, now: Date) {
  for (const node of block.nodes) {
    if (node.completedAt || !node.sessionId) continue;
    const session = await tx.practiceSession.findFirst({ where: { id: node.sessionId, userId: block.userId },
      select: { questionIds: true, attempts: { where: { userId: block.userId }, select: { questionId: true } } } });
    if (!session || !session.questionIds.length) continue;
    const attempted = new Set(session.attempts.map(attempt => attempt.questionId));
    if (session.questionIds.every(id => attempted.has(id))) {
      await tx.learningRoadNode.update({ where: { id: node.id }, data: { completedAt: now } });
    }
  }
  return tx.learningRoadBlock.findUniqueOrThrow({ where: { id: block.id }, include: includeNodes });
}

async function view(tx: Prisma.TransactionClient, block: Block | null,
  learning: Awaited<ReturnType<typeof learningState>>): Promise<LearningRoadView> {
  const statuses = roadStatuses(block?.nodes ?? []);
  const nodes = await Promise.all((block?.nodes ?? []).map(async (node, index) => {
    const skill = learning.skills.find(item => item.id === node.skillId);
    const check = node.sessionId ? await tx.learningCheck.findUnique({ where: { sessionId: node.sessionId }, select: { status: true } }) : null;
    return { id: node.id, key: node.key, type: node.type as RoadNodeType, skillId: node.skillId,
      reason: node.reason as RoadReason, prerequisiteIds: node.prerequisiteIds,
      questionCount: node.questionCount, estimatedMinutes: node.estimatedMinutes,
      status: statuses[index], nameRu: node.skill.nameRu, nameKk: node.skill.nameKk,
      masteryScore: skill && skill.state !== "insufficient" ? skill.masteryScore : null,
      distinctQuestions: skill?.distinctQuestions ?? 0, sessionId: node.sessionId,
      unavailable: node.unavailable, skipped: node.skipped, outcome: check?.status ?? null,
      prerequisites: learning.skills.filter(item => node.prerequisiteIds.includes(item.id))
        .map(item => ({ id: item.id, nameRu: item.nameRu, nameKk: item.nameKk })) };
  }));
  return { id: block?.id ?? null, sequence: block?.sequence ?? 0, nodes,
    completedCount: nodes.filter(node => node.status === "COMPLETED").length,
    needsDiagnostic: learning.needsDiagnostic, finished: !!nodes.length && nodes.every(node => node.status === "COMPLETED") };
}

export async function getLearningRoad(userId: string, nextBlock = false) {
  return prisma.$transaction(async tx => {
    await lockAccount(tx, userId);
    await assertNoActiveExam(tx, userId);
    const now = new Date(), learning = await learningState(tx, userId, now);
    let block = await tx.learningRoadBlock.findFirst({ where: { userId, programVersion: 0 }, orderBy: { sequence: "desc" }, include: includeNodes });
    if (block) block = await syncBlock(tx, block, now);
    if (nextBlock && block?.nodes.some(node => !node.completedAt)) throw new PracticeError("road_block_unfinished", 409);
    const initialDiagnostic = block && learning.diagnosticId && learning.diagnosticId !== block.diagnosticId
      && block.nodes.every(node => !node.completedAt && !node.sessionId);
    if (!block || nextBlock || initialDiagnostic) {
      const specs = buildLearningRoad(learning.state, skillGraph(learning.skills.map(skill => skill.id)));
      const latest = await tx.learningRoadBlock.findFirst({ where: { userId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
      if (specs.length) block = await tx.learningRoadBlock.create({ data: { userId, sequence: (latest?.sequence ?? 0) + 1, diagnosticId: learning.diagnosticId,
        nodes: { create: specs.map((spec, position) => ({ ...spec, position })) } }, include: includeNodes });
    }
    return view(tx, block, learning);
  }, { maxWait: 10000, timeout: 20000 });
}

export async function runRoadNode(userId: string, nodeId: string, operation: "start" | "complete_theory" | "skip_unavailable") {
  return prisma.$transaction(async tx => {
    await lockAccount(tx, userId);
    await assertNoActiveExam(tx, userId);
    const node = await tx.learningRoadNode.findFirst({ where: { id: nodeId, block: { userId, programVersion: 0 } }, include: { block: true } });
    if (!node) throw new PracticeError("road_node_missing", 404);
    if (operation === "complete_theory") {
      if (node.type !== "THEORY") throw new PracticeError("road_theory_only", 400);
      if (!node.completedAt) await tx.learningRoadNode.update({ where: { id: nodeId }, data: { completedAt: new Date() } });
      return { completed: true };
    }
    if (operation === "skip_unavailable") {
      if (!node.unavailable) throw new PracticeError("road_not_unavailable", 409);
      await tx.learningRoadNode.update({ where: { id: nodeId }, data: { skipped: true, completedAt: node.completedAt ?? new Date() } });
      return { completed: true };
    }
    if (node.type === "THEORY") return { href: `/learn/rules/${encodeURIComponent(node.skillId)}?roadNodeId=${node.id}` };
    if (node.completedAt) return node.sessionId ? { href: `/practice/session/${node.sessionId}` } : { completed: true };
    const latest = await tx.learningRoadBlock.findFirst({ where: { userId, programVersion: 0 }, orderBy: { sequence: "desc" }, select: { id: true } });
    if (latest?.id !== node.blockId) throw new PracticeError("road_block_archived", 409);
    if (node.sessionId) return { href: `/practice/session/${node.sessionId}` };
    let sessionId: string | undefined;
    if (node.type === "REVIEW" || node.type === "CHECKPOINT") {
      // A schedule may have changed through the daily plan or another training.
      // Reuse the scheduler's due gate and version protection, never invent a review.
      const review = await tx.skillReview.findUnique({ where: { userId_skillId: { userId, skillId: node.skillId } } });
      if (node.type !== "REVIEW" || review && localDay(new Date(), review.timeZone) >= review.dueDay) {
        const check = await startLearningCheck(tx, userId, { skillId: node.skillId,
          purpose: node.type === "REVIEW" ? "review" : "confirmation" });
        sessionId = check?.sessionId;
      }
    } else {
      // Use the existing skill-targeted selection and immutable A–E snapshots.
      const checkpoint = await tx.learningRoadNode.findFirst({ where: { blockId: node.blockId, skillId: node.skillId,
        type: "CHECKPOINT", sessionId: null, completedAt: null }, select: { id: true } });
      const reserved = checkpoint ? (await similarQuestions(tx, userId, node.skillId, 1))[0]?.id : undefined;
      const pending = await tx.learningCheck.findMany({ where: { userId, status: "pending" }, select: { questionId: true } });
      const excluded = new Set([...pending.map(check => check.questionId), ...(reserved ? [reserved] : [])]);
      const selected = await selectQuestionsForSession({ userId, mode: "mixed", skillId: node.skillId,
        count: Math.min(19, node.questionCount + excluded.size) });
      const questionIds = selected.filter(id => !excluded.has(id)).slice(0, node.questionCount);
      if (questionIds.length) {
        const session = await tx.practiceSession.create({ data: { userId, mode: "mixed", totalCount: questionIds.length,
          questionIds, choiceSnapshots: await makeChoiceSnapshots(tx, questionIds) } });
        sessionId = session.id;
        await tx.learningRoadNode.update({ where: { id: nodeId }, data: { questionCount: questionIds.length } });
      }
    }
    await tx.learningRoadNode.update({ where: { id: nodeId }, data: { sessionId, unavailable: !sessionId } });
    return sessionId ? { href: `/practice/session/${sessionId}` } : { unavailable: true };
  }, { maxWait: 10000, timeout: 20000 });
}
