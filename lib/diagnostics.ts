import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { lockAccount, PracticeError } from "./practiceStorage";
import { DIAGNOSTIC_QUESTION_IDS, DIAGNOSTIC_FOLLOWUPS, SKILLS } from "./skillCatalog";
import { explainSkillError, recommendSkillQuestion, refreshSkillProgress } from "./skillProgress";
import { calculateSkillProgress, skillOutcomes } from "./skillMastery";
import { stepAnswerSchema } from "./validators";
import { validateExpression, validateNumber } from "../services/sympy";
import type { StepResult } from "../types";
import { missingQuestionTranslations } from './i18n/content';
import { assertNoActiveExam } from "./exam/guard";
import { ensureProgram, json } from "./learning-road/program-data";

const diagnosticInclude = { topic: true, subtopic: true, skills: true,
  steps: { include: { options: true, skills: true }, orderBy: { order: "asc" as const } } };
type DiagnosticQuestion = Prisma.QuestionGetPayload<{ include: typeof diagnosticInclude }>;
export async function diagnosticQuestion(tx: Prisma.TransactionClient, session: { questionSnapshots: Prisma.JsonValue }, questionId: string) {
  const saved = (session.questionSnapshots as Record<string, unknown>)[questionId] as DiagnosticQuestion | undefined;
  return saved ?? tx.question.findUnique({ where: { id: questionId }, include: diagnosticInclude });
}
function publicDiagnosticQuestion(q: DiagnosticQuestion) {
  return { id: q.id, topicId: q.topicId, subtopicId: q.subtopicId, title: q.title, titleKk: q.titleKk,
    questionText: q.questionText, questionTextKk: q.questionTextKk, latex: q.latex, difficulty: q.difficulty,
    answerType: q.answerType, topic: q.topic, subtopic: q.subtopic,
    steps: q.steps.map(s => ({ id: s.id, questionId: q.id, order: s.order, type: s.type, prompt: s.prompt,
      promptKk: s.promptKk, hasHint: false,
      options: s.options.map(o => ({ id: o.id, stepId: s.id, text: o.text, textKk: o.textKk, order: o.order })) })) };
}

export const diagnosticSubmissionSchema = z.object({
  submissionId: z.string().uuid(), questionId: z.string(), revision: z.number().int().nonnegative(),
  stepAnswers: z.array(stepAnswerSchema).min(1).max(50).refine((a) => new Set(a.map((s) => s.stepId)).size === a.length),
}).strict();
export const diagnosticDraftSchema = z.object({ revision: z.number().int().nonnegative(), currentIndex: z.number().int().nonnegative(),
  answers: z.record(z.string().max(2000)).refine((a) => Object.keys(a).length <= 50) }).strict();

export async function readDiagnosticSnapshot(tx: Prisma.TransactionClient, sessionId: string, userId: string) {
  await assertNoActiveExam(tx, userId, true);
  const session = await tx.diagnosticSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new PracticeError("Diagnostic not found", 404);
  const answers = await tx.diagnosticAnswer.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
  const questionId = session.status === "active" ? session.questionIds[session.currentIndex] : null;
  const question = questionId ? await diagnosticQuestion(tx, session, questionId) : null;
  return { id: session.id, status: session.status, questionIds: session.questionIds, currentIndex: session.currentIndex,
    totalCount: session.questionIds.length, completedCount: answers.length, revision: session.revision,
    draftAnswers: session.draftAnswers, startedAt: session.startedAt, completedAt: session.completedAt,
    question: question ? publicDiagnosticQuestion(question) : null,
    // Submitted answers are recoverable, but correctness and answer keys stay private until completion.
    answers: answers.map((a) => ({ questionId: a.questionId, stepAnswers: (a.stepResults as unknown as StepResult[]).map((s) => ({ stepId: s.stepId, answer: s.userAnswer })) })),
    result: session.status === "completed" ? session.result : null,
  };
}

export async function startDiagnostic(userId: string, restartFromId?: string, language: 'ru' | 'kk' = 'ru') {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    await assertNoActiveExam(tx, userId, true);
    if (restartFromId) {
      const source = await tx.diagnosticSession.findFirst({ where: { id: restartFromId, userId, status: "completed" } });
      if (!source) throw new PracticeError("Completed source diagnostic not found", 404);
      const replay = await tx.diagnosticSession.findUnique({ where: { userId_restartFromId: { userId, restartFromId } } });
      if (replay) return readDiagnosticSnapshot(tx, replay.id, userId);
    }
    const existing = await tx.diagnosticSession.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } });
    // This is an entrance assessment. Repeated clicks resume or open the saved result.
    if (existing && (!restartFromId || existing.status === "active")) return readDiagnosticSnapshot(tx, existing.id, userId);
    const count = await tx.question.count({ where: { id: { in: DIAGNOSTIC_QUESTION_IDS }, purpose: "diagnostic" } });
    if (count !== DIAGNOSTIC_QUESTION_IDS.length) throw new PracticeError("Diagnostic bank is unavailable; apply the skill data upgrade", 503);
    if (language === 'kk') {
      const bank = await tx.question.findMany({ where: { id: { in: DIAGNOSTIC_QUESTION_IDS } },
        include: { steps: { include: { options: true }, orderBy: { order: 'asc' } } } });
      if (bank.some((q) => missingQuestionTranslations(q).length)) throw new PracticeError('Diagnostic Kazakh translations are incomplete', 503);
    }
    const bank = await tx.question.findMany({ where: { skills: { some: {} } }, include: diagnosticInclude,
      orderBy: [{ difficulty: "asc" }, { id: "asc" }] });
    const selected = [...DIAGNOSTIC_QUESTION_IDS];
    const covered = new Set<string>(SKILLS.map(s => s.id));
    const catalog = await tx.skill.findMany({ orderBy: { id: "asc" } });
    for (const skill of catalog) {
      if (covered.has(skill.id)) continue;
      const candidate = bank.find(q => q.purpose === "practice" && q.skills.some(s => s.skillId === skill.id) &&
        q.steps.some(s => s.skills.some(l => l.skillId === skill.id)) && q.steps.every(s => ["numeric_input", "expression_input", "multiple_choice"].includes(s.type)) &&
        (language !== "kk" || !missingQuestionTranslations(q).length));
      if (candidate) { if (!selected.includes(candidate.id)) selected.push(candidate.id); candidate.skills.forEach(s => covered.add(s.skillId)); }
    }
    const session = await tx.diagnosticSession.create({ data: { userId, questionIds: selected, restartFromId,
      questionSnapshots: json(Object.fromEntries(bank.filter(q => selected.includes(q.id)).map(q => [q.id, q]))) } });
    return readDiagnosticSnapshot(tx, session.id, userId);
  }, { maxWait: 10000, timeout: 10000 });
}

async function finishDiagnostic(tx: Prisma.TransactionClient, sessionId: string, userId: string) {
  const savedSession = await tx.diagnosticSession.findUniqueOrThrow({ where: { id: sessionId } });
  const storedAnswers = await tx.diagnosticAnswer.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" }, include: {
    question: { include: { steps: { include: { skills: true }, orderBy: { order: "asc" } } } },
  } });
  const answers = await Promise.all(storedAnswers.map(async a => ({ ...a, question: (await diagnosticQuestion(tx, savedSession, a.questionId))! })));
  const skillIds = new Set<string>();
  for (const answer of answers) {
    for (const outcome of skillOutcomes(answer.question.steps, answer.stepResults as unknown as StepResult[])) {
      skillIds.add(outcome.skillId);
      const previous = await tx.skillObservation.count({ where: { userId, skillId: outcome.skillId, questionId: answer.questionId } });
      const exposed = await tx.questionHelp.count({ where: { userId, questionId: answer.questionId } }) +
        await tx.userAttempt.count({ where: { userId, questionId: answer.questionId } }) +
        await tx.practiceSession.count({ where: { userId, hintedQuestionIds: { has: answer.questionId } } }) +
        await tx.examSession.count({ where: { userId, questionIds: { has: answer.questionId } } });
      await tx.skillObservation.create({ data: { ...outcome, userId, questionId: answer.questionId,
        diagnosticAnswerId: answer.id, usedHint: exposed > 0, difficulty: answer.question.difficulty,
        attemptNumber: previous + 1, createdAt: answer.createdAt } });
    }
  }
  await refreshSkillProgress(tx, userId, [...skillIds]);
  const skills = [];
  for (const skill of await tx.skill.findMany({ orderBy: { id: "asc" } })) {
    const evidence = answers.flatMap((answer) => (answer.stepResults as unknown as StepResult[])
      .filter((step) => step.skillIds?.includes(skill.id)).map((step) => {
        const options = answer.question.steps.find(s => s.id === step.stepId)?.options ?? [];
        const selected = options.find(o => o.id === step.userAnswer || o.text === step.userAnswer);
        const expected = options.find(o => o.isCorrect);
        return { ...step, userAnswerText: selected?.text ?? step.userAnswer, userAnswerTextKk: selected?.textKk,
        expectedAnswerText: expected?.text ?? step.expectedAnswer, expectedAnswerTextKk: expected?.textKk, questionId: answer.questionId,
        questionText: answer.question.questionText, questionTextKk: answer.question.questionTextKk,
        explanation: answer.question.explanation, explanationKk: answer.question.explanationKk }; }));
    const observations = await tx.skillObservation.findMany({ where: { userId, skillId: skill.id, diagnosticAnswer: { sessionId } } });
    const progress = calculateSkillProgress(observations);
    const failures = evidence.filter((e) => !e.isCorrect);
    // A single failed answer is an observation, never a confident diagnosis.
    skills.push({ ...skill, ...progress, assessment: progress.state === "insufficient" ? "insufficient" : failures.length ? "gap_observed" : "no_gap_observed",
      evidence, recommendation: await recommendSkillQuestion(tx, userId, skill.id,
        DIAGNOSTIC_FOLLOWUPS[(failures[0] ?? evidence[0])?.questionId ?? ""]) });
  }
  const report = { skills, correctCount: answers.filter((a) => a.isCorrect).length, totalCount: answers.length };
  await tx.diagnosticSession.update({ where: { id: sessionId, userId }, data: {
    status: "completed", completedAt: new Date(), result: JSON.parse(JSON.stringify(report)),
  } });
  await ensureProgram(tx, userId);
}

export async function submitDiagnostic(userId: string, sessionId: string, data: z.infer<typeof diagnosticSubmissionSchema>) {
  const hash = createHash("sha256").update(JSON.stringify({ questionId: data.questionId,
    stepAnswers: [...data.stepAnswers].sort((a, b) => a.stepId.localeCompare(b.stepId)) })).digest("hex");
  const session = await prisma.diagnosticSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new PracticeError("Diagnostic not found", 404);
  const question = await diagnosticQuestion(prisma, session, data.questionId);
  if (!question || !session.questionIds.includes(question.id)) throw new PracticeError("Question is not part of this diagnostic", 400);
  const answerMap = new Map(data.stepAnswers.map((a) => [a.stepId, a.answer]));
  if (answerMap.size !== question.steps.length || question.steps.some((s) => !answerMap.has(s.id))) throw new PracticeError("Provide one answer for every step", 400);
  const stepResults: StepResult[] = [];
  for (const step of question.steps) {
    const userAnswer = answerMap.get(step.id)!;
    const isCorrect = step.type === "numeric_input" ? (await validateNumber(userAnswer, step.expectedAnswer)).isEquivalent
      : step.type === "expression_input" ? (await validateExpression(userAnswer, step.expectedAnswer)).isEquivalent
      : step.type === "multiple_choice" ? step.options.some((o) => o.isCorrect && (o.id === userAnswer || o.text === userAnswer))
      : step.expectedAnswer === userAnswer;
    stepResults.push({ stepId: step.id, stepOrder: step.order, userAnswer, isCorrect, expectedAnswer: step.expectedAnswer,
      skillIds: step.skills.map((s) => s.skillId),
      ...(!isCorrect ? { feedback: explainSkillError(userAnswer, step.expectedAnswer, step.misconceptions) } : {}),
    });
  }
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    await assertNoActiveExam(tx, userId, true);
    const owned = await tx.diagnosticSession.findFirst({ where: { id: sessionId, userId } });
    if (!owned) throw new PracticeError("Diagnostic not found", 404);
    const duplicate = await tx.diagnosticAnswer.findUnique({ where: { sessionId_submissionId: { sessionId, submissionId: data.submissionId } } });
    if (duplicate) {
      if (duplicate.submissionHash !== hash) throw new PracticeError("Submission ID already used for another answer", 409);
      return { accepted: true, questionId: duplicate.questionId }; // Stable receipt, including after completion.
    }
    if (owned.status !== "active" || owned.revision !== data.revision || owned.questionIds[owned.currentIndex] !== data.questionId) throw new PracticeError("Diagnostic changed; reload the saved state", 409);
    if (await tx.diagnosticAnswer.findUnique({ where: { sessionId_questionId: { sessionId, questionId: data.questionId } } })) throw new PracticeError("Question already answered", 409);
    const correctSteps = stepResults.filter((s) => s.isCorrect).length;
    await tx.diagnosticAnswer.create({ data: { sessionId, questionId: data.questionId, submissionId: data.submissionId,
      submissionHash: hash, isCorrect: correctSteps === stepResults.length, score: Math.round(100 * correctSteps / stepResults.length),
      stepResults: JSON.parse(JSON.stringify(stepResults)) } });
    await tx.diagnosticSession.update({ where: { id: sessionId, userId }, data: {
      currentIndex: { increment: 1 }, revision: { increment: 1 }, draftAnswers: {},
    } });
    if (owned.currentIndex + 1 === owned.questionIds.length) await finishDiagnostic(tx, sessionId, userId);
    return { accepted: true, questionId: data.questionId };
  }, { maxWait: 10000, timeout: 20000 });
}
