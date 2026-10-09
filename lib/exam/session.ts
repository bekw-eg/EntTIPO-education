import { createHash, randomInt } from "node:crypto";
import { ExamSession, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { lockAccount, PracticeError } from "../practiceStorage";
import { refreshSkillProgress } from "../skillProgress";
import { auditCoverage } from "./coverage";
import { assessExamReadiness } from "./readiness";
import { getExamProfile, type ExamProfile } from "./profile";
import { gradeExamQuestion, publicExamQuestion, remainingSeconds, saveExamSchema, startExamSchema, type PaperQuestion } from "./mode";
import { hasContentTranslation } from '../i18n/content';
import { completeProgramAssessment } from "../learning-road/program-data";
import { mathematicalStemKey, unusedCandidates } from './history';
import type { ExamCandidate } from './readiness';
import { GENERATED_IDENTITIES, LEGACY_MATH_ALIASES } from './generated-bank';


const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const options = { maxWait: 15000, timeout: 30000 };
export async function examServerNow(tx: Prisma.TransactionClient) {
  // clock_timestamp(), unlike NOW(), advances while a transaction waits for an account lock.
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row.now;
}
function shuffled<T>(rows: T[]) {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
async function ownedExam(tx: Prisma.TransactionClient, userId: string, id: string) {
  const exam = await tx.examSession.findFirst({ where: { id, userId } });
  if (!exam) throw new PracticeError("Экзамен не найден", 404);
  return exam;
}
export async function readExamAvailability(tx: Prisma.TransactionClient, profile: ExamProfile, language: 'ru' | 'kk' = 'ru', userId?: string) {
  const bank = await tx.question.findMany({ orderBy: { id: "asc" }, include: {
    topic: true, skills: { include: { skill: true } }, steps: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } }, skills: true } },
  } });
  const coverage = auditCoverage(profile, bank, undefined, language);
  const byId = new Map(bank.map(q => [q.id, q]));
  // Require both whole-task and actual tested-step skill mappings for mastery evidence.
  let candidates: ExamCandidate[] = coverage.questions.filter((q) => {
    const source = byId.get(q.id)!;
    return q.eligible && (language !== 'kk' || hasContentTranslation(source.topic.name, source.topic.nameKk) &&
      source.skills.every(s => hasContentTranslation(s.skill.nameRu, s.skill.nameKk))) &&
      q.skillIds.every(s => source.steps[0].skills.some(link => link.skillId === s));
  })
    .map((q) => ({ id: q.id, contentHash: q.contentHash, mathKey: q.mathKey, pointCode: q.pointCode!, band: q.band!, family: q.family! }));
  // Keep the first stable representative (legacy IDs sort first); aliases are
  // still recorded below so old history reserves the whole equivalence class.
  const distinct = new Map<string,ExamCandidate>();
  for(const q of candidates) if(!distinct.has(q.mathKey!)) distinct.set(q.mathKey!,q);
  candidates=shuffled([...distinct.values()]);
  if (userId) {
    // No status/profile/language filter: every created paper reserves its tasks,
    // including historical snapshots made before this mechanism existed.
    const history = await tx.examSession.findMany({ where: { userId }, select: { questionIds: true, paper: true } });
    const identities = new Map([...GENERATED_IDENTITIES.values()].map(q=>[q.id,
      { mathKey:q.mathKey,stemKey:mathematicalStemKey(q.text) }]));
    for(const [id,mathKey] of LEGACY_MATH_ALIASES) identities.set(id,{mathKey,stemKey:''});
    for(const q of coverage.questions) identities.set(q.id,{mathKey:q.mathKey,stemKey:mathematicalStemKey(q.questionText,q.latex)});
    candidates = unusedCandidates(candidates, history, identities);
  }
  const readiness = assessExamReadiness(profile, candidates, 1, true);
  const shortages = readiness.points.filter((p) => p.missingInPlan).map((p) => ({
    pointCode: p.pointCode, title: profile.points.find((s) => s.code === p.pointCode)!.title, missing: p.missingInPlan,
  }));
  return { bank, candidates, readiness, shortages };
}

export async function prepareExam(tx: Prisma.TransactionClient, profile: ExamProfile, userId: string, language: 'ru' | 'kk' = 'ru') {
  const { bank, candidates, readiness, shortages } = await readExamAvailability(tx, profile, language, userId);
  if (!readiness.canGenerate) return { paper: null, readiness, shortages };
  const paper: PaperQuestion[] = [];
  for (const id of shuffled(readiness.selectedQuestionIds)) {
    const q = bank.find((b) => b.id === id)!, candidate = candidates.find((c) => c.id === id)!;
    const [observations, attempts, help, previousExams] = await Promise.all([
      tx.skillObservation.count({ where: { userId, questionId: id } }),
      tx.userAttempt.count({ where: { userId, questionId: id } }),
      tx.questionHelp.count({ where: { userId, questionId: id } }),
      tx.examSession.count({ where: { userId, status: "completed", questionIds: { has: id } } }),
    ]);
    paper.push({ ...candidate, topicId: q.topicId, topicName: language === 'kk' ? q.topic.nameKk! : q.topic.name,
      skillIds: q.skills.map((s) => s.skillId), skillNames: q.skills.map((s) => language === 'kk' ? s.skill.nameKk : s.skill.nameRu),
      title: language === 'kk' ? q.titleKk! : q.title, questionText: language === 'kk' ? q.questionTextKk! : q.questionText, latex: q.latex,
      options: q.steps[0].options.map((o) => language === 'kk' ? o.textKk! : o.text), correctIndex: q.steps[0].options.findIndex((o) => o.isCorrect),
      explanation: language === 'kk' ? q.explanationKk! : q.explanation, difficulty: q.difficulty, previouslyExposed: observations > 0 || attempts > 0 || help > 0 || previousExams > 0 });
  }
  return { paper, readiness, shortages };
}

async function finalizeExam(tx: Prisma.TransactionClient, exam: ExamSession, now: Date, reason: "student" | "timeout") {
  if (exam.status === "completed") return exam;
  const profile = exam.profileSnapshot as unknown as ExamProfile;
  const paper = exam.paper as unknown as PaperQuestion[], answers = exam.answers as Record<string, number>;
  const kk = exam.language === 'kk';
  const questions = paper.map((q) => gradeExamQuestion(profile, q, answers[q.id]));
  const completedAt = reason === "timeout" ? exam.deadlineAt : now;
  const skillIds = [...new Set(paper.flatMap((q) => q.skillIds))];
  // Omissions affect official points but are not evidence of an independently attempted skill.
  for (const [index, q] of paper.entries()) {
    if (questions[index].skipped) continue;
    for (const skillId of q.skillIds) {
      const previous = await tx.skillObservation.count({ where: { userId: exam.userId, skillId, questionId: q.id } });
      await tx.skillObservation.create({ data: { userId: exam.userId, examSessionId: exam.id,
        questionId: q.id, skillId, score: questions[index].isCorrect ? 100 : 0,
        isCorrect: questions[index].isCorrect, isPartial: false, usedHint: q.previouslyExposed,
        difficulty: q.difficulty, attemptNumber: previous + 1, createdAt: completedAt } });
    }
  }
  await refreshSkillProgress(tx, exam.userId, skillIds.filter((id) => paper.some((q) => q.skillIds.includes(id) && answers[q.id] !== undefined)));
  const skills = [];
  for (const skillId of skillIds) {
    const related = questions.filter((q) => q.skillIds.includes(skillId));
    const progress = await tx.userSkillProgress.findUnique({ where: { userId_skillId: { userId: exam.userId, skillId } } });
    skills.push({ skillId, name: paper.find((q) => q.skillIds.includes(skillId))!.skillNames[
      paper.find((q) => q.skillIds.includes(skillId))!.skillIds.indexOf(skillId)],
    points: related.reduce((s, q) => s + q.points, 0), maxPoints: related.reduce((s, q) => s + q.maxPoints, 0),
    skipped: related.filter((q) => q.skipped).length, masteryScore: progress?.masteryScore ?? null,
    state: progress?.state ?? "insufficient", observationCount: progress?.observationCount ?? 0 });
  }
  const gaps = questions.filter((q) => !q.isCorrect).map((q) => ({ questionId: q.id,
    pointCode: q.pointCode, title: q.title, skillIds: q.skillIds, reason: q.skipped ? "skipped" : "wrong_answer",
    action: q.skipped ? (kk ? `${q.pointCode} тармағының тапсырмасын уақыт шектеуінсіз шешіп, басқа есеппен өзіңізді тексеріңіз.` : `Решите задание по пункту ${q.pointCode} без ограничения времени, затем проверьте себя на другой задаче.`) :
      (kk ? `${q.pointCode} тармағының шешімін талдап, ережені қайталаңыз және басқа тапсырманы өздігінен шешіңіз.` : `Разберите решение по пункту ${q.pointCode}, повторите правило и решите другое задание самостоятельно.`),
    ruleHref: `/learn/rules/${q.skillIds[0]}`, practiceHref: `/practice?mode=specific_topic&topicId=${q.topicId}&skillId=${q.skillIds[0]}` }));
  // Only attempted wrong answers create mistakes. A skipped task has an unknown cause and is shown in gaps.
  for (const [index, q] of paper.entries()) if (!questions[index].skipped && !questions[index].isCorrect) {
    for (const [skillIndex, skillId] of q.skillIds.entries()) await tx.mistake.create({ data: {
      userId: exam.userId, examSessionId: exam.id, questionId: q.id, topicId: q.topicId,
      skillId, weakSkill: q.skillNames[skillIndex], errorType: "unclassified",
      userAnswer: q.options[answers[q.id]], correctAnswer: q.options[q.correctIndex],
      explanation: kk ? 'Қате жауап тіркелді. Оның себебін өздігінен тексеру қажет.' : "Зафиксирован неверный ответ. Его причина требует самостоятельной проверки.", description: q.explanation,
    } });
  }
  const preparation = await completeProgramAssessment(tx, exam, paper, questions, completedAt);
  const result = { preparation, points: questions.reduce((s, q) => s + q.points, 0), maxPoints: profile.official.maxPoints,
    skipped: questions.filter((q) => q.skipped).length, completionReason: reason, completedAt,
    topics: [...new Set(paper.map((q) => q.topicId))].map((topicId) => {
      const related = questions.filter((q) => q.topicId === topicId);
      return { topicId, name: related[0].topicName, points: related.reduce((s, q) => s + q.points, 0),
        maxPoints: related.reduce((s, q) => s + q.maxPoints, 0), skipped: related.filter((q) => q.skipped).length };
    }), skills, questions, gaps, recommendations: gaps.length ? gaps.slice(0, 5).map((g) => ({ ...g })) : [
      { action: kk ? 'Блоктың нәтижесі сақталды. Күндік жоспарды жалғастырып, дағдыларды жаңа тапсырмалармен тексеріңіз: бір жауап толық меңгеруді дәлелдемейді.' : "Результат блока сохранён. Продолжайте план дня и проверьте навыки на новых заданиях: один ответ не доказывает полного освоения.", ruleHref: "/", practiceHref: "/practice" }],
    planHref: "/", previouslyExposedCount: paper.filter((q) => q.previouslyExposed).length,
    masteryPolicy: kk ? 'Емтихан балдары бөлек есептеледі. Дағдыны меңгеру көрсеткіші жауап берілген әр тапсырмадан бір бақылау алады; өткізіп жіберілгендер әрекет болып саналмайды. Бұрын ашылған тапсырмалар өздік меңгеруді растамайды. Жаттығу санауыштары, серия және күндік мақсат артпайды.' : "Баллы экзамена считаются отдельно. Mastery навыков получает одно наблюдение за отвеченное задание; пропуски не считаются попытками. Ранее раскрытые задания не дают независимого доказательства. Счётчики тренировок, серии и дневная цель не увеличиваются." };
  return tx.examSession.update({ where: { id: exam.id }, data: { status: "completed", result: json(result),
    completedAt, completionReason: reason, revision: { increment: 1 } } });
}
async function snapshot(tx: Prisma.TransactionClient, exam: ExamSession, now: Date) {
  if (exam.status === "active" && now >= exam.deadlineAt) exam = await finalizeExam(tx, exam, now, "timeout");
  // Opening an older report during a new exam must not disclose a recycled answer key.
  if (exam.status === "completed" && await tx.examSession.count({ where: { userId: exam.userId, status: "active" } })) {
    throw new PracticeError("Разбор предыдущего экзамена доступен после завершения текущего", 403);
  }
  return { id: exam.id, status: exam.status, profile: exam.profileSnapshot, roadNodeId: exam.roadNodeId,
    language: exam.language, durationMinutes: exam.durationMinutes, timePolicy: "platform_training",
    startedAt: exam.startedAt, deadlineAt: exam.deadlineAt, serverNow: now,
    remainingSeconds: exam.status === "active" ? remainingSeconds(exam.deadlineAt, now) : 0,
    questions: (exam.paper as unknown as PaperQuestion[]).map(publicExamQuestion),
    answers: exam.answers, currentIndex: exam.currentIndex, flaggedQuestionIds: exam.flaggedQuestionIds,
    revision: exam.revision, completedAt: exam.completedAt, result: exam.status === "completed" ? exam.result : null };
}
export async function startExam(userId: string, data: z.infer<typeof startExamSchema>) {
  const profile = getExamProfile(data.profileId);
  if (!profile || profile.version !== data.profileVersion) throw new PracticeError("Неизвестный профиль или версия", 404);
  const outcome = await prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const startHash = hash({ profileId: data.profileId, profileVersion: data.profileVersion,
      language: data.language, durationMinutes: data.durationMinutes });
    const replay = await tx.examSession.findUnique({ where: { userId_startRequestId: { userId, startRequestId: data.requestId } } });
    if (replay) {
      if (replay.startHash !== startHash) throw new PracticeError("Этот идентификатор запуска уже использован с другими настройками", 409);
      return snapshot(tx, replay, await examServerNow(tx));
    }
    const [resumedRequest] = await tx.$queryRaw<{ examId: string; startHash: string }[]>`
      SELECT "examId", "startHash" FROM "ExamStartRequest"
      WHERE "userId"=${userId} AND "requestId"=${data.requestId}`;
    if (resumedRequest) {
      if (resumedRequest.startHash !== startHash) throw new PracticeError("Этот идентификатор запуска уже использован с другими настройками", 409);
      return snapshot(tx, await ownedExam(tx,userId,resumedRequest.examId), await examServerNow(tx));
    }
    const active = await tx.examSession.findFirst({ where: { userId, status: "active" } });
    if (active) {
      await tx.$executeRaw`INSERT INTO "ExamStartRequest" ("userId","requestId","examId","startHash")
        VALUES (${userId},${data.requestId},${active.id},${startHash})`;
      return snapshot(tx, active, await examServerNow(tx));
    }
    const prepared = await prepareExam(tx, profile, userId, data.language);
    if (!prepared.paper) return { unavailable: true as const, readiness: prepared.readiness, shortages: prepared.shortages };
    const now = await examServerNow(tx);
    const exam = await tx.examSession.create({ data: { userId, startRequestId: data.requestId, startHash,
      profileId: profile.id, profileVersion: profile.version, language: data.language, profileSnapshot: json(profile),
      paper: json(prepared.paper), questionIds: prepared.paper.map((q) => q.id),
      startedAt: now, deadlineAt: new Date(now.getTime() + data.durationMinutes * 60000), durationMinutes: data.durationMinutes } });
    return snapshot(tx, exam, now);
  }, options);
  if ('unavailable' in outcome) {
    // Commit the refusal outside the generation transaction: throwing an HTTP
    // error must not roll back the internal shortage audit.
    const details = JSON.stringify({ requestId:data.requestId, readiness:outcome.readiness, shortages:outcome.shortages });
    await prisma.$executeRaw`INSERT INTO "ExamBankAudit" ("userId","profileId","language","details")
      VALUES (${userId},${profile.id},${data.language},${details}::jsonb)`;
    throw new PracticeError(data.language==='kk'
      ? `Жаңа тапсырмалар жеткіліксіз. Қайталанған тапсырмалар берілмейді. Нәтижелерді ашуға болады. Тармақтар: ${outcome.shortages.map(s=>s.pointCode).join(', ')}.`
      : `Доступные новые варианты исчерпаны: не хватает ${outcome.readiness.shortage} заданий для структуры 20, A/B/C=5/10/5. Повторы не подставляются. Результаты прежних попыток доступны. Пункты: ${outcome.shortages.map(s=>`${s.pointCode} — ${s.title}`).join('; ')}. Дефицит сложности: ${outcome.readiness.difficulty.filter(d=>d.missingInPlan).map(d=>`${d.band}: ${d.missingInPlan}`).join(', ')||'нет'}.`,422);
  }
  return outcome;
}
export async function readExam(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    return snapshot(tx, await ownedExam(tx, userId, id), await examServerNow(tx));
  }, options);
}
export async function saveExam(userId: string, id: string, data: z.infer<typeof saveExamSchema>) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const exam = await ownedExam(tx, userId, id), now = await examServerNow(tx);
    if (exam.status === "completed" || now >= exam.deadlineAt) return snapshot(tx, exam, now);
    const saveHash = hash({ ...data, answers: Object.fromEntries(Object.entries(data.answers).sort()), flaggedQuestionIds: [...data.flaggedQuestionIds].sort() });
    if (exam.lastSaveId === data.requestId) {
      if (exam.lastSaveHash !== saveHash) throw new PracticeError("Идентификатор сохранения уже использован", 409);
      return snapshot(tx, exam, now);
    }
    if (exam.revision !== data.revision) throw new PracticeError("Состояние изменено в другой вкладке. Загрузите сохранённую версию.", 409);
    if (data.currentIndex >= exam.questionIds.length || [...Object.keys(data.answers), ...data.flaggedQuestionIds].some((id) => !exam.questionIds.includes(id))) {
      throw new PracticeError("Ответ или позиция не принадлежат варианту", 400);
    }
    const paper = exam.paper as unknown as PaperQuestion[];
    if (Object.entries(data.answers).some(([id, answer]) => answer >= paper.find(q => q.id === id)!.options.length)) {
      throw new PracticeError("Invalid exam answer", 400);
    }
    const saved = await tx.examSession.update({ where: { id }, data: { answers: data.answers,
      currentIndex: data.currentIndex, flaggedQuestionIds: data.flaggedQuestionIds,
      revision: { increment: 1 }, lastSaveId: data.requestId, lastSaveHash: saveHash } });
    return snapshot(tx, saved, now);
  }, options);
}
export async function finishExam(userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const exam = await ownedExam(tx, userId, id), now = await examServerNow(tx);
    return snapshot(tx, await finalizeExam(tx, exam, now, now >= exam.deadlineAt ? "timeout" : "student"), now);
  }, options);
}
export async function listExams(userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);
    const now = await examServerNow(tx), active = await tx.examSession.findFirst({ where: { userId, status: "active" } });
    if (active && now >= active.deadlineAt) await finalizeExam(tx, active, now, "timeout");
    const exams = await tx.examSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" } });
    return exams.map((exam) => ({ id: exam.id, status: exam.status, profileId: exam.profileId, profileVersion: exam.profileVersion,
      language: exam.language, startedAt: exam.startedAt, completedAt: exam.completedAt,
      maxPoints: exam.status === "completed" ? Number((exam.result as Record<string, Prisma.JsonValue>).maxPoints) : exam.questionIds.length,
      points: exam.status === "completed" ? (exam.result as Record<string, Prisma.JsonValue>).points : null }));
  }, options);
}
