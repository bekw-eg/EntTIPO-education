import { prisma } from "@/lib/prisma";
import type { SubmitAttemptInput } from "@/lib/validators";
import { validateNumber, validateExpression } from "@/services/sympy";
import { calculateMasteryScore, calculateNextDifficulty } from "@/lib/mastery";
import { ErrorType, StepResult } from "@/types";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { summarizeAttempts } from "@/lib/practiceStats";
import { explainSkillError, recordPracticeSkills } from "@/lib/skillProgress";
import { recordLearningAttempt } from "@/lib/learningChecks";
import { dayBounds, studentTimeZone } from "@/lib/learningPolicy";
import { assertNoActiveExam } from "@/lib/exam/guard";

import { validateOffline, type SyncMeta } from "./offline/server";
import { choiceStepId, gradeChoice, sessionChoice } from "./practiceChoice";

function replaySubmission(attempt: { submissionHash: string | null; submissionResult: Prisma.JsonValue | null }, hash: string) {
  if (attempt.submissionHash !== hash) throw new PracticeError("Submission ID has already been used for another answer", 409);
  if (!attempt.submissionResult) throw new PracticeError("Submission result is not available", 409);
  return attempt.submissionResult;
}

function determineErrorType(stepResults: StepResult[], question: any): ErrorType {
  const failedSteps = stepResults.filter((s) => !s.isCorrect);
  if (failedSteps.length === 0) return "calculation_error";

  const firstFailed = failedSteps[0];
  if (firstFailed.stepOrder === 1) return "concept_error";
  if (question.answerType === "expression") return "algebra_error";
  return "calculation_error";
}

export async function submitAttempt(userId: string, data: SubmitAttemptInput, offline?: SyncMeta) {
    await assertNoActiveExam(prisma, userId);
    const submissionHash = createHash("sha256").update(JSON.stringify({
      sessionId: data.sessionId,
      questionId: data.questionId,
      stepAnswers: [...data.stepAnswers].sort((a, b) => a.stepId.localeCompare(b.stepId)),
      timeSpent: data.timeSpent,
      usedHint: data.usedHint,
    })).digest("hex");
    const previousSubmission = await prisma.userAttempt.findUnique({
      where: { userId_submissionId: { userId, submissionId: data.submissionId } },
      select: { submissionHash: true, submissionResult: true },
    });
    if (previousSubmission) return prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      return replaySubmission(previousSubmission, submissionHash);
    });

    const session = await prisma.practiceSession.findFirst({
      where: { id: data.sessionId, userId },
      select: { id: true, status: true, questionIds: true, mode: true },
    });
    if (!session) {
      throw new PracticeError("Session not found", 404);
    }
    if (!session.questionIds.includes(data.questionId)) {
      throw new PracticeError("Question is not part of this session", 400);
    }
    if (session.mode === "offline_practice" && !offline) throw new PracticeError("Use offline synchronization for this training", 409);
    const offlinePackage = offline ? await prisma.$transaction(tx => validateOffline(tx, userId, data.sessionId, data.questionId, offline, false)) : null;

    const question = await prisma.question.findUnique({
      where: { id: data.questionId },
      include: {
        subtopic: true,
        skills: true,
        steps: { include: { options: true, skills: { include: { skill: true } } }, orderBy: { order: "asc" } },
      },
    });

    if (!question) {
      throw new PracticeError("Question not found", 404);
    }
    if (question.purpose === "diagnostic") throw new PracticeError("Use the diagnostic endpoint for this question", 400);

    const answerMap = new Map(data.stepAnswers.map((answer) => [answer.stepId, answer.answer]));
    // Compatibility is determined by the saved package, never by a client-chosen payload shape.
    const offlineQuestion = offlinePackage ? (offlinePackage.content as unknown as import("./offline/types").OfflineContent)
      .questions.find(q => q.id === question.id) : null;
    const useChoices = !offline || offlineQuestion?.steps.some(step => step.id === choiceStepId(question.id));
    const choice = useChoices ? await prisma.$transaction(async tx => {
      await lockAccount(tx, userId);
      const owned = await tx.practiceSession.findFirst({ where: { id: data.sessionId, userId } });
      if (!owned) throw new PracticeError("Session not found", 404);
      return sessionChoice(tx, owned, question.id);
    }) : null;
    if (choice ? answerMap.size !== 1 || !answerMap.has(choiceStepId(question.id)) :
      answerMap.size !== question.steps.length || question.steps.some((step) => !answerMap.has(step.id))) {
      throw new PracticeError("Provide exactly one answer for every step of this question", 400);
    }

    const stepResults: StepResult[] = [];
    let correctSteps = 0;

    const choiceGrade = choice ? gradeChoice(choice, answerMap.get(choiceStepId(question.id))!) : null;
    const markedError = choice && choiceGrade && !choiceGrade.isCorrect && choiceGrade.selectedOptionIds.length === 1
      ? choice.options.find(o => o.id === choiceGrade.selectedOptionIds[0])?.misconception : undefined;
    if (choice && choiceGrade) {
      correctSteps = Number(choiceGrade.isCorrect);
      stepResults.push({ stepId: choiceStepId(question.id), stepOrder: 1, isCorrect: choiceGrade.isCorrect,
        userAnswer: answerMap.get(choiceStepId(question.id))!, expectedAnswer: JSON.stringify(choice.correctOptionIds),
        skillIds: choice.skillIds, ...(markedError ? { feedback: { ru: markedError.ru, kk: markedError.kk } } : {}) });
    }
    for (const step of choice ? [] : question.steps) {
      let isCorrect = false;
      const userAns = answerMap.get(step.id)!;

      if (step.type === "multiple_choice") {
        const correctOpt = step.options.find((o) => o.isCorrect);
        if (
          correctOpt &&
          correctOpt.id === userAns
        ) {
          isCorrect = true;
        }
      } else if (step.type === "multiple_select") {
        try {
          const selected: unknown = JSON.parse(userAns);
          const expected = step.options.filter(o => o.isCorrect).map(o => o.id).sort();
          isCorrect = Array.isArray(selected) && selected.every(v => typeof v === "string") &&
            selected.length === new Set(selected).size && JSON.stringify([...selected].sort()) === JSON.stringify(expected);
        } catch { isCorrect = false; }
      } else if (step.type === "numeric_input") {
        const res = await validateNumber(userAns, step.expectedAnswer);
        isCorrect = res.isEquivalent;
      } else if (step.type === "expression_input") {
        const res = await validateExpression(userAns, step.expectedAnswer);
        isCorrect = res.isEquivalent;
      } else {
        isCorrect = userAns.toLowerCase() === step.expectedAnswer.trim().toLowerCase();
      }

      if (isCorrect) correctSteps++;

      stepResults.push({
        stepId: step.id,
        stepOrder: step.order,
        isCorrect,
        userAnswer: userAns,
        expectedAnswer: step.expectedAnswer,
        skillIds: step.skills.map((link) => link.skillId),
        ...(!isCorrect && step.skills.length ? { feedback: explainSkillError(userAns, step.expectedAnswer, step.misconceptions) } : {}),
      });
    }

    const totalSteps = choice ? 1 : question.steps.length;
    const isCorrect = totalSteps > 0 && correctSteps === totalSteps;
    const isPartial = correctSteps > 0 && correctSteps < totalSteps;
    const score = totalSteps > 0 ? Math.round((correctSteps / totalSteps) * 100) : 0;
    const errorType = isCorrect ? undefined : choice ? markedError?.errorType ?? "unclassified" : determineErrorType(stepResults, question);

    const result = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      // A concurrent copy of this request may already have committed while grading ran.
      const duplicate = await tx.userAttempt.findUnique({
        where: { userId_submissionId: { userId, submissionId: data.submissionId } },
        select: { submissionHash: true, submissionResult: true },
      });
      if (duplicate) return replaySubmission(duplicate, submissionHash);
      const ownedSession = await tx.practiceSession.findFirst({ where: { id: data.sessionId, userId } });
      if (!ownedSession) throw new PracticeError("Session not found", 404);
      if (offline) await validateOffline(tx, userId, data.sessionId, data.questionId, offline, true);
      if (ownedSession.status !== "active" && !(offline?.reconcile)) throw new PracticeError("Session is already completed", 409);
      if (!offline && (ownedSession.questionIds[ownedSession.currentIndex] !== question.id || ownedSession.currentAttemptId)) {
        throw new PracticeError("Question already checked or position changed; use an explicit retry", 409);
      }
      if (ownedSession.topicId && ownedSession.topicId !== question.topicId) {
        throw new PracticeError("Question does not match the session topic", 400);
      }
      if (!ownedSession.questionIds.includes(question.id)) throw new PracticeError("Question is not part of this session", 400);
      const sessionAttempts = await tx.userAttempt.findMany({
        where: { userId, sessionId: data.sessionId },
        select: { questionId: true, isCorrect: true },
      });
      const prevCount = sessionAttempts.filter((attempt) => attempt.questionId === question.id).length;
      if (prevCount === 0 && summarizeAttempts(sessionAttempts).completedCount >= ownedSession.totalCount) {
        throw new PracticeError("All questions in this session have already been answered", 409);
      }
      const priorHelp = await tx.questionHelp.findUnique({ where: { userId_questionId: { userId, questionId: question.id } } });
      const exposedExam = await tx.examSession.count({ where: { userId, status: "completed", questionIds: { has: question.id } } });
      const exposedDiagnostic = await tx.diagnosticAnswer.count({ where: { questionId: question.id, session: { userId } } });
      const usedHint = !!offline || data.usedHint || ownedSession.hintedQuestionIds.includes(question.id) || !!priorHelp || exposedExam > 0 || exposedDiagnostic > 0;
      const latestAttempt = await tx.userAttempt.findFirst({
        where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
      });
      // Database NOW() uses transaction start time, which can precede the lock wait.
      // Give serialized attempts a stable chronological order, even within one millisecond.
      const createdAt = new Date(Math.max(Date.now(), (latestAttempt?.createdAt.getTime() ?? 0) + 1));

      const attempt = await tx.userAttempt.create({
        data: {
          userId,
          questionId: question.id,
          sessionId: data.sessionId,
          isCorrect,
          isPartial,
          score,
          timeSpent: data.timeSpent || 0,
          usedHint,
          submissionId: data.submissionId,
          submissionHash,
          createdAt,
          attemptNumber: prevCount + 1,
          stepAnswers: {
            create: (choice ? [] : stepResults).map((sr) => ({
              stepId: sr.stepId,
              answer: sr.userAnswer,
              isCorrect: sr.isCorrect,
            })),
          },
        },
      });

      if (choice && choiceGrade && !isCorrect) {
        const skill = markedError?.skillId ? await tx.skill.findUnique({ where: { id: markedError.skillId } }) : null;
        await tx.mistake.create({ data: { userId, attemptId: attempt.id, questionId: question.id,
          topicId: question.topicId, subtopicId: question.subtopicId, errorType: errorType!,
          skillId: skill?.id, weakSkill: skill?.nameRu,
          userAnswer: choice.options.filter(o => choiceGrade.selectedOptionIds.includes(o.id)).map(o => o.text).join("; "),
          correctAnswer: choice.options.filter(o => choice.correctOptionIds.includes(o.id)).map(o => o.text).join("; "),
          explanation: markedError?.ru ?? choice.explanation, description: choice.explanation } });
      }
      if (!choice && !isCorrect && errorType) {
        const combinedUserAnswer = stepResults
          .map((sr) => sr.userAnswer)
          .filter(Boolean)
          .join("; ");

        // A failed mapped step creates a precise mistake. Untagged failures remain unassigned.
        const failures = stepResults.filter((sr) => !sr.isCorrect);
        const mappedFailures = failures.flatMap((sr) => question.steps.find((s) => s.id === sr.stepId)!.skills.map((link) => ({ sr, link })));
        const hasUnmappedFailure = failures.some((sr) => question.steps.find((s) => s.id === sr.stepId)!.skills.length === 0);
        for (const failure of [...mappedFailures, ...(hasUnmappedFailure ? [null] : [])]) await tx.mistake.create({
          data: {
            userId,
            attemptId: attempt.id,
            questionId: question.id,
            topicId: question.topicId,
            subtopicId: question.subtopicId,
            errorType,
            skillId: failure?.link.skillId,
            stepId: failure?.sr.stepId,
            weakSkill: failure?.link.skill.nameRu,
            userAnswer: failure?.sr.userAnswer ?? (combinedUserAnswer || undefined),
            correctAnswer: failure?.sr.expectedAnswer ?? question.correctAnswer,
            explanation: failure?.sr.feedback?.ru ?? question.explanation,
            description: question.explanation,
          },
        });
      }

      await recordPracticeSkills(tx, { userId, attemptId: attempt.id, questionId: question.id,
        difficulty: question.difficulty, usedHint, attemptNumber: attempt.attemptNumber,
        createdAt, steps: choice ? [{ id: choiceStepId(question.id), skills: choice.skillIds.map(skillId => ({ skillId })) }] : question.steps, stepResults });
      const learningCheck = await recordLearningAttempt(tx, attempt, question);

      // Update topic progress
      const currentProgress = (await tx.userTopicProgress.findUnique({
        where: { userId_topicId: { userId, topicId: question.topicId } },
      })) || { masteryScore: 0, currentLevel: 1, totalAttempts: 0, correctAttempts: 0 };

      const recentAttempts = await tx.userAttempt.findMany({
        where: { userId, question: { topicId: question.topicId } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        include: { question: true },
      });

      // Both algorithms expect oldest first; query the newest ten, then reverse them.
      const chronologicalAttempts = [...recentAttempts].reverse();
      const newScore = calculateMasteryScore(
        chronologicalAttempts.map((a) => ({
          isCorrect: a.isCorrect,
          isPartial: a.isPartial,
          score: a.score,
          usedHint: a.usedHint,
          difficulty: a.question.difficulty,
          attemptNumber: a.attemptNumber,
        })),
        currentProgress.masteryScore
      );

      const newLevel = calculateNextDifficulty(
        currentProgress.currentLevel,
        chronologicalAttempts.map((a) => ({ isCorrect: a.isCorrect }))
      );

      await tx.userTopicProgress.upsert({
        where: { userId_topicId: { userId, topicId: question.topicId } },
        update: {
          masteryScore: newScore,
          currentLevel: newLevel,
          totalAttempts: { increment: 1 },
          correctAttempts: isCorrect ? { increment: 1 } : undefined,
          lastAttemptAt: new Date(),
        },
        create: {
          userId,
          topicId: question.topicId,
          masteryScore: newScore,
          currentLevel: newLevel,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
          lastAttemptAt: new Date(),
        },
      });

      const sessionStats = {
        ...summarizeAttempts([...sessionAttempts, { questionId: question.id, isCorrect }]),
        totalCount: ownedSession.totalCount,
        mode: ownedSession.mode,
      };
      await tx.practiceSession.update({
        where: { id: data.sessionId, userId },
        data: { completedCount: sessionStats.completedCount, correctCount: sessionStats.correctCount,
          ...(offline ? {
            revision: { increment: 1 }, currentIndex: Math.max(ownedSession.currentIndex, offline.sequence + 1),
            currentAttemptId: null, draftAnswers: {},
            ...(Math.max(ownedSession.currentIndex, offline.sequence + 1) >= ownedSession.totalCount ? { status: "completed", completedAt: new Date() } : {}),
          } : ownedSession.questionIds[ownedSession.currentIndex] === question.id ? {
            currentAttemptId: attempt.id, draftAnswers: Object.fromEntries(answerMap), revision: { increment: 1 },
          } : {}),
        },
      });

      // Update DailyGoal
      const profile = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timeZone: true } });
      const { gte: today, lt: tomorrow } = dayBounds(createdAt, studentTimeZone(profile.timeZone));
      const todayQuestions = await tx.userAttempt.findMany({
        where: { userId, createdAt: { gte: today, lt: tomorrow } },
        select: { questionId: true },
        distinct: ["questionId"],
      });

      await tx.dailyGoal.upsert({
        where: { userId_date: { userId, date: today } },
        update: { completedCount: todayQuestions.length },
        create: {
          userId,
          date: today,
          targetCount: 20,
          completedCount: todayQuestions.length,
        },
      });

      const savedResult = {
        ...(offline ? { submissionId: data.submissionId, offlineRevision: ownedSession.revision + 1 } : {}),
        attemptId: attempt.id,
        isCorrect,
        isPartial,
        score,
        stepResults,
        explanation: choice?.explanation ?? question.explanation,
        explanationKk: choice?.explanationKk ?? question.explanationKk,
        correctAnswer: choice ? choice.options.filter(o => choice.correctOptionIds.includes(o.id)).map(o => o.text).join("; ") : question.correctAnswer,
        ...(choice && choiceGrade ? { choice: { selectedOptionIds: choiceGrade.selectedOptionIds,
          correctOptionIds: choice.correctOptionIds, options: choice.options.map(({ id, text, textKk }) => ({ id, text, textKk })),
          solutionSteps: choice.solutionSteps } } : {}),
        errorType,
        usedHint,
        attemptNumber: attempt.attemptNumber,
        sessionStats,
        learningCheck,
      };
      // Persist the response in the same transaction so a lost response can be replayed exactly.
      const snapshot = JSON.parse(JSON.stringify(savedResult)) as Prisma.InputJsonValue;
      await tx.userAttempt.update({ where: { id: attempt.id, userId }, data: { submissionResult: snapshot } });
      return snapshot;
    }, { maxWait: 10000, timeout: 10000 });

    return result;
}
