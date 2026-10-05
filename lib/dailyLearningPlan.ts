import { DailyLearningPlan, LearningPlanAction, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { lockAccount, PracticeError } from "./practiceStorage";
import { readUserSkills } from "./skillProgress";
import { addDays, dayBounds, dayStart, localDay, rankPlanSkills, studentTimeZone } from "./learningPolicy";
import { similarQuestions, startLearningCheck } from "./learningChecks";

type Plan = DailyLearningPlan & { actions: LearningPlanAction[] };
const actionsInclude = { actions: { orderBy: { position: "asc" as const } } };

async function resumeUnfinishedSession(tx: Prisma.TransactionClient, userId: string, sessionId: string) {
  const session = await tx.practiceSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new PracticeError("Session not found", 404);
  if (session.status !== "active") {
    const attempts = await tx.userAttempt.findMany({ where: { userId, sessionId }, select: { questionId: true } });
    const index = session.questionIds.findIndex((id) => !attempts.some((a) => a.questionId === id));
    if (index >= 0) await tx.practiceSession.update({ where: { id: sessionId }, data: { status: "active", completedAt: null,
      currentIndex: index, currentAttemptId: null, revision: { increment: 1 } } });
  }
  return { href: `/practice/session/${sessionId}` };
}

async function syncPlan(tx: Prisma.TransactionClient, plan: Plan, now: Date) {
  for (const action of plan.actions) {
    if (action.completedAt || action.status === "superseded") continue;
    if (action.kind === "practice" && action.questionIds.length) {
      const bounds = { gte: dayStart(plan.day, plan.timeZone), lt: dayStart(addDays(plan.day, 1), plan.timeZone) };
      const attempts = await tx.userAttempt.findMany({ where: { userId: plan.userId, questionId: { in: action.questionIds },
        OR: [{ createdAt: { gte: bounds.gte, lt: bounds.lt } }, ...(action.sessionId ? [{ sessionId: action.sessionId }] : [])] },
        select: { questionId: true } });
      if (new Set(attempts.map((a) => a.questionId)).size >= action.questionIds.length) {
        await tx.learningPlanAction.update({ where: { id: action.id }, data: { status: "completed", completedAt: now } });
      }
    }
    if (action.kind === "check" && action.mistakeId && !action.reasons.includes("review_skill")) {
      const mistake = await tx.mistake.findFirst({ where: { id: action.mistakeId, userId: plan.userId, confirmedAt: { not: null } },
        include: { confirmationAttempt: { select: { sessionId: true } } } });
      if (mistake) await tx.learningPlanAction.update({ where: { id: action.id },
        data: { status: "completed", completedAt: mistake.confirmedAt, sessionId: mistake.confirmationAttempt?.sessionId ?? action.sessionId } });
    }
  }
  return tx.dailyLearningPlan.findUniqueOrThrow({ where: { id: plan.id }, include: actionsInclude });
}

async function buildActions(tx: Prisma.TransactionClient, plan: DailyLearningPlan, now: Date, position = 0) {
  const userId = plan.userId;
  const [skills, observations, mistakes, reviews, todayAttempts] = await Promise.all([
    readUserSkills(tx, userId),
    tx.skillObservation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { diagnosticAnswer: { select: { sessionId: true } } } }),
    tx.mistake.findMany({ where: { userId, confirmedAt: null, skillId: { not: null } }, include: { question: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    tx.skillReview.findMany({ where: { userId } }),
    tx.userAttempt.findMany({ where: { userId, createdAt: { gte: dayBounds(now, plan.timeZone).gte, lt: dayBounds(now, plan.timeZone).lt } },
      include: { question: { include: { skills: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
  ]);
  if (!observations.length) {
    await tx.learningPlanAction.create({ data: { planId: plan.id, position, kind: "diagnostic", reasons: ["new_account"] } });
    return;
  }
  // Adding a catalog skill is not evidence that the learner needs spaced review.
  // Rank assessed/practised skills; new exam skills enter after their first observation.
  const assessed = new Set([...observations.map((o) => o.skillId), ...mistakes.map((m) => m.skillId), ...reviews.map((r) => r.skillId)]);
  const signals = skills.filter((s) => assessed.has(s.id)).map((s) => {
    const recent = observations.filter((o) => o.skillId === s.id && now.getTime() - o.createdAt.getTime() <= 14 * 86400000);
    const review = reviews.find((r) => r.skillId === s.id);
    return { id: s.id, state: s.state, masteryScore: s.masteryScore,
      due: !!review && localDay(now, review.timeZone) >= review.dueDay,
      recentMistakes: mistakes.filter((m) => m.skillId === s.id && now.getTime() - m.createdAt.getTime() <= 14 * 86400000).length,
      diagnosticFailures: recent.filter((o) => o.diagnosticAnswer?.sessionId === plan.diagnosticId && !o.isCorrect).length,
      hints: recent.filter((o) => o.usedHint).length,
      daysSincePractice: s.lastAttemptAt ? Math.max(0, Math.floor((now.getTime() - s.lastAttemptAt.getTime()) / 86400000)) : 30 };
  });
  const selected = rankPlanSkills(signals)[0];
  if (!selected) {
    await tx.learningPlanAction.create({ data: { planId: plan.id, position, kind: "diagnostic", status: "blocked", reasons: ["no_bank"] } });
    return;
  }
  const mistake = mistakes.find((m) => m.skillId === selected.id);
  const recentDifficulty = observations.find((o) => o.skillId === selected.id)?.difficulty ?? 1;
  const difficulty = mistake?.question.difficulty ?? Math.min(5, recentDifficulty + Number(selected.reasons.includes("maintenance")));
  const candidates = await tx.question.findMany({ where: { purpose: "practice", skills: { some: { skillId: selected.id } },
    difficulty: { gte: Math.max(1, difficulty - 1), lte: Math.min(5, difficulty + 1) } },
    select: { id: true, difficulty: true, attempts: { where: { userId }, take: 1, select: { id: true } } },
    orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
  // Reserve the independent check before selecting practice, so its answer is never shown in practice.
  const checkCandidates = await similarQuestions(tx, userId, selected.id, difficulty, mistake ? [mistake.questionId] : []);
  const checkQuestion = checkCandidates[0];
  const doneToday = [...new Set(todayAttempts.filter((a) => a.question.skills.some((s) => s.skillId === selected.id))
    .map((a) => a.questionId))].slice(0, 3);
  candidates.sort((a, b) => Number(a.attempts.length > 0) - Number(b.attempts.length > 0)
    || Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty) || a.id.localeCompare(b.id));
  const practiceIds = [...doneToday, ...candidates.filter((q) => q.id !== checkQuestion?.id && !doneToday.includes(q.id)).map((q) => q.id)].slice(0, 3);
  const common = { planId: plan.id, skillId: selected.id, reasons: selected.reasons };
  await tx.learningPlanAction.create({ data: { ...common, position, kind: "rule" } });
  await tx.learningPlanAction.create({ data: { ...common, position: position + 1, kind: "practice", questionIds: practiceIds,
    status: practiceIds.length >= 3 ? "ready" : "blocked" } });
  await tx.learningPlanAction.create({ data: { ...common, position: position + 2, kind: "check", mistakeId: mistake?.id,
    questionIds: checkQuestion ? [checkQuestion.id] : [], status: checkQuestion ? "ready" : "blocked",
    reasons: [...selected.reasons, ...(mistake ? ["confirm_error"] : [selected.due ? "review_skill" : "self_check"])] } });
}

async function ensurePlan(tx: Prisma.TransactionClient, userId: string, now: Date, recalculate = false): Promise<Plan> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
  const timeZone = studentTimeZone(user.timeZone), day = localDay(now, timeZone);
  const diagnostic = await tx.diagnosticSession.findFirst({ where: { userId, status: "completed" }, orderBy: { completedAt: "desc" } });
  let plan = await tx.dailyLearningPlan.findUnique({ where: { userId_day: { userId, day } }, include: actionsInclude });
  if (plan) {
    if (plan.status !== "active") {
      await tx.dailyLearningPlan.updateMany({ where: { userId, status: "active" }, data: { status: "archived" } });
      plan = await tx.dailyLearningPlan.update({ where: { id: plan.id }, data: { status: "active" }, include: actionsInclude });
    }
    plan = await syncPlan(tx, plan, now);
    const visible = plan.actions.filter((a) => a.status !== "superseded");
    const diagnosticOnly = visible.length > 0 && visible.every((a) => a.kind === "diagnostic");
    if (diagnostic && diagnostic.id !== plan.diagnosticId && (recalculate || diagnosticOnly)) {
      if (visible.some((a) => a.kind !== "diagnostic" && (a.completedAt || a.sessionId))) {
        throw new PracticeError("Started plans are preserved; new diagnostic results apply tomorrow", 409);
      }
      await tx.learningPlanAction.updateMany({ where: { planId: plan.id, kind: { not: "diagnostic" }, status: { not: "superseded" } }, data: { status: "superseded" } });
      await tx.learningPlanAction.updateMany({ where: { planId: plan.id, kind: "diagnostic", completedAt: null }, data: { status: "completed", completedAt: diagnostic.completedAt } });
      plan = await tx.dailyLearningPlan.update({ where: { id: plan.id }, data: { diagnosticId: diagnostic.id }, include: actionsInclude });
      await buildActions(tx, plan, now, plan.actions.length);
    } else if (recalculate) throw new PracticeError("No new completed diagnostic is available", 409);
  } else {
    const previous = await tx.dailyLearningPlan.findFirst({ where: { userId, status: "active" }, orderBy: { day: "desc" }, include: actionsInclude });
    const synced = previous ? await syncPlan(tx, previous, now) : null;
    await tx.dailyLearningPlan.updateMany({ where: { userId, status: "active" }, data: { status: "archived" } });
    plan = await tx.dailyLearningPlan.create({ data: { userId, day, timeZone, diagnosticId: diagnostic?.id }, include: actionsInclude });
    const pending = synced?.actions.filter((a) => !a.completedAt && a.status !== "superseded") ?? [];
    const hasTraining = pending.some((a) => a.sessionId && (a.kind === "practice" || a.kind === "check"));
    if (hasTraining) {
      for (const [position, a] of pending.entries()) {
        const session = a.sessionId && a.kind === "practice" ? await tx.practiceSession.findUnique({ where: { id: a.sessionId } }) : null;
        await tx.learningPlanAction.create({ data: { planId: plan.id, position,
        kind: a.kind, skillId: a.skillId, mistakeId: a.mistakeId, sessionId: a.sessionId,
        questionIds: session?.questionIds ?? a.questionIds, reasons: [...a.reasons, "carried"], status: a.status } });
      }
    } else await buildActions(tx, plan, now);
  }
  return syncPlan(tx, await tx.dailyLearningPlan.findUniqueOrThrow({ where: { id: plan.id }, include: actionsInclude }), now);
}

async function planView(tx: Prisma.TransactionClient, plan: Plan) {
  const latest = await tx.diagnosticSession.findFirst({ where: { userId: plan.userId, status: "completed" }, orderBy: { completedAt: "desc" }, select: { id: true } });
  const actions = await Promise.all(plan.actions.filter((a) => a.status !== "superseded").map(async (action) => {
    const skill = action.skillId ? await tx.skill.findUnique({ where: { id: action.skillId } }) : null;
    const review = action.skillId ? await tx.skillReview.findUnique({ where: { userId_skillId: { userId: plan.userId, skillId: action.skillId } } }) : null;
    const mistake = action.mistakeId ? await tx.mistake.findFirst({ where: { id: action.mistakeId, userId: plan.userId },
      select: { id: true, questionId: true, confirmedAt: true, confirmationAttemptId: true, isReviewed: true } }) : null;
    const check = action.sessionId ? await tx.learningCheck.findUnique({ where: { sessionId: action.sessionId }, select: { status: true, purpose: true } }) : null;
    const practiceAttempts = action.kind === "practice" ? await tx.userAttempt.findMany({ where: { userId: plan.userId,
      questionId: { in: action.questionIds }, OR: [{ createdAt: { gte: dayStart(plan.day, plan.timeZone), lt: dayStart(addDays(plan.day, 1), plan.timeZone) } },
        ...(action.sessionId ? [{ sessionId: action.sessionId }] : [])] }, select: { questionId: true } }) : [];
    return { ...action, skill, mistake, check, nextReviewDay: review?.dueDay ?? null,
      completedQuestionCount: action.completedAt && action.kind === "practice" ? action.questionIds.length : new Set(practiceAttempts.map((a) => a.questionId)).size };
  }));
  return { ...plan, actions, canRecalculate: !!latest && latest.id !== plan.diagnosticId
    && actions.every((a) => a.kind === "diagnostic" || (!a.completedAt && !a.sessionId)) };
}

export async function getDailyLearningPlan(userId: string, now = new Date(), recalculate = false) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    return planView(tx, await ensurePlan(tx, userId, now, recalculate));
  }, { maxWait: 10000, timeout: 20000 });
}

export async function runPlanAction(userId: string, actionId: string, operation: "start" | "complete_rule") {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const action = await tx.learningPlanAction.findFirst({ where: { id: actionId, plan: { userId }, status: { not: "superseded" } }, include: { plan: true } });
    if (!action) throw new PracticeError("Plan action not found", 404);
    if (operation === "complete_rule") {
      if (action.kind !== "rule") throw new PracticeError("Only rule viewing can be marked manually", 400);
      if (!action.completedAt) await tx.learningPlanAction.update({ where: { id: action.id }, data: { completedAt: new Date(), status: "completed" } });
      return { completed: true };
    }
    if (action.kind === "diagnostic") return { href: "/diagnostics" };
    if (action.kind === "rule") return { href: `/learn/rules/${action.skillId}?actionId=${action.id}` };
    if (action.kind === "practice") {
      if (action.sessionId) return resumeUnfinishedSession(tx, userId, action.sessionId);
      if (action.completedAt) return { completed: true };
      if (action.questionIds.length < 3) return { unavailable: true };
      const bounds = dayBounds(new Date(), action.plan.timeZone);
      const done = await tx.userAttempt.findMany({ where: { userId, questionId: { in: action.questionIds },
        createdAt: { gte: bounds.gte, lt: bounds.lt } }, select: { questionId: true } });
      const remaining = action.questionIds.filter((id) => !done.some((a) => a.questionId === id));
      if (!remaining.length) {
        await tx.learningPlanAction.update({ where: { id: action.id }, data: { status: "completed", completedAt: new Date() } });
        return { completed: true };
      }
      const session = await tx.practiceSession.create({ data: { userId, mode: "mixed", totalCount: remaining.length, questionIds: remaining } });
      await tx.learningPlanAction.update({ where: { id: action.id }, data: { sessionId: session.id } });
      return { href: `/practice/session/${session.id}` };
    }
    if (!action.skillId) return { unavailable: true };
    const existing = action.sessionId ? await tx.learningCheck.findUnique({ where: { sessionId: action.sessionId } }) : null;
    if (existing?.status === "pending") return resumeUnfinishedSession(tx, userId, existing.sessionId);
    if (action.completedAt) return { completed: true };
    const practice = await tx.learningPlanAction.findMany({ where: { planId: action.planId, kind: "practice" } });
    const preferred = action.questionIds[0] ? await tx.question.findUnique({ where: { id: action.questionIds[0] }, select: { difficulty: true } }) : null;
    const check = await startLearningCheck(tx, userId, { skillId: action.skillId, mistakeId: action.mistakeId,
      preferredQuestionId: action.questionIds[0], excluded: practice.flatMap((a) => a.questionIds),
      targetDifficulty: preferred?.difficulty,
      purpose: action.reasons.includes("review_skill") ? "review" : "confirmation" });
    if (!check) {
      await tx.learningPlanAction.update({ where: { id: action.id }, data: { status: "blocked" } });
      return { unavailable: true };
    }
    await tx.learningPlanAction.update({ where: { id: action.id }, data: { sessionId: check.sessionId, questionIds: [check.questionId], status: "ready" } });
    return { href: `/practice/session/${check.sessionId}` };
  }, { maxWait: 10000, timeout: 20000 });
}
