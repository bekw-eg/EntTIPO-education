import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { PracticeError, recordHintUsage, recordQuestionHelp } from "@/lib/practiceStorage";
import { assertNoActiveExam } from "@/lib/exam/guard";
import {
  aiTutorRequestSchema,
  aiErrorAnalysisSchema,
  aiSimilarQuestionSchema,
} from "@/lib/validators";
import {
  callGemini,
  checkRateLimit,
  FALLBACK_MESSAGES,
  RATE_LIMIT_MESSAGES,
} from "@/lib/ai/gemini";
import {
  buildHintPrompt,
  buildExplainConditionPrompt,
  buildWhyFormulaPrompt,
  buildCheckStepsPrompt,
  buildExplainFormulaPrompt,
  buildErrorAnalysisPrompt,
  buildSimilarQuestionPrompt,
  buildChatPrompt,
  getBaseSystemPrompt,
  QuestionContext,
  UserContext,
} from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    await assertNoActiveExam(prisma, userId);
    const body = await request.json();
    const parseResult = aiTutorRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const lang = data.language || "ru";

    if (data.sessionId) {
      const session = await prisma.practiceSession.findFirst({
        where: { id: data.sessionId, userId }, select: { id: true, status: true, questionIds: true },
      });
      if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
      if (session.status !== "active") return NextResponse.json({ error: "Session is already completed" }, { status: 409 });
      if (data.questionId && !session.questionIds.includes(data.questionId)) {
        return NextResponse.json({ error: "Question is not part of this session" }, { status: 400 });
      }
    }

    // An attempt supplied by the client must belong to this account and question.
    if (data.attemptId) {
      const attempt = await prisma.userAttempt.findFirst({
        where: { id: data.attemptId, userId },
        select: { questionId: true, sessionId: true },
      });
      if (!attempt) {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
      }
      if (data.questionId && data.questionId !== attempt.questionId) {
        return NextResponse.json({ error: "Attempt does not match the question" }, { status: 400 });
      }
      if (data.sessionId && data.sessionId !== attempt.sessionId) {
        return NextResponse.json({ error: "Attempt does not match the session" }, { status: 400 });
      }
      data.questionId = attempt.questionId;
    }

    // 1. Rate Limiting Check
    if (data.questionId && await prisma.question.count({ where: { id: data.questionId, purpose: "diagnostic" } })) {
      return NextResponse.json({ error: "AI help is disabled for entrance diagnostic tasks" }, { status: 403 });
    }
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: RATE_LIMIT_MESSAGES[lang] || RATE_LIMIT_MESSAGES.ru },
        { status: 429 }
      );
    }

    // All assistance tied to a task is evidence of help, including calls without sessionId.
    const helpSession = data.sessionId ? await prisma.practiceSession.findFirst({
      where: { id: data.sessionId, userId }, select: { questionIds: true, currentIndex: true },
    }) : null;
    const helpQuestionId = data.questionId ?? helpSession?.questionIds[helpSession.currentIndex];
    if (helpQuestionId && await prisma.question.count({ where: { id: helpQuestionId } })) await recordQuestionHelp(userId, helpQuestionId);

    // 2. Resolve Question and Topic details if questionId is provided
    let questionRecord: any = null;
    let topicRecord: any = null;
    let userProgressRecord: any = null;
    let previousMistakes: any[] = [];

    if (data.questionId) {
      questionRecord = await prisma.question.findUnique({
        where: { id: data.questionId },
        include: {
          topic: true,
          subtopic: true,
          steps: { include: { options: true }, orderBy: { order: "asc" } },
        },
      });

      if (questionRecord) {
        topicRecord = questionRecord.topic;
        userProgressRecord = await prisma.userTopicProgress.findUnique({
          where: { userId_topicId: { userId, topicId: questionRecord.topicId } },
        });

        previousMistakes = await prisma.mistake.findMany({
          where: { userId, topicId: questionRecord.topicId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { errorType: true, weakSkill: true },
        });
      }
    } else if (data.topicId) {
      topicRecord = await prisma.topic.findUnique({
        where: { id: data.topicId },
      });

      if (topicRecord) {
        userProgressRecord = await prisma.userTopicProgress.findUnique({
          where: { userId_topicId: { userId, topicId: data.topicId } },
        });
      }
    }

    const masteryScore = userProgressRecord?.masteryScore ?? 50;
    const currentLevel = userProgressRecord?.currentLevel ?? 1;

    const previousWeakSkills = Array.from(
      new Set(
        previousMistakes
          .map((m) => m.weakSkill || m.errorType)
          .filter((s): s is string => Boolean(s))
      )
    );

    const questionContext: QuestionContext = {
      id: questionRecord?.id,
      title: questionRecord?.title || "Математическая задача",
      questionText: questionRecord?.questionText || "",
      latex: questionRecord?.latex || null,
      difficulty: questionRecord?.difficulty || 1,
      topicName: topicRecord?.name || "Математика",
      subtopicName: questionRecord?.subtopic?.name || null,
      correctAnswer: questionRecord?.correctAnswer || "",
      steps: questionRecord?.steps?.map((s: any) => ({
        order: s.order,
        prompt: s.prompt,
        expectedAnswer: s.expectedAnswer,
        hint: s.hint,
      })),
    };

    const userContext: UserContext = {
      language: lang,
      masteryScore,
      currentLevel,
      userAnswer: data.userAnswer,
      stepAnswers: data.stepAnswers,
      previousWeakSkills,
      previousErrorTypes: previousMistakes.map((m) => m.errorType),
    };

    // 3. Dispatch AI Actions
    switch (data.action) {
      case "hint": {
        const level = data.hintLevel || 1;
        const prompt = buildHintPrompt(questionContext, userContext, level);
        const text = await callGemini(prompt.system, prompt.user);
        if (data.sessionId && questionRecord) await recordHintUsage(userId, data.sessionId, questionRecord.id);
        return NextResponse.json({
          action: "hint",
          hintLevel: level,
          text,
        });
      }

      case "explain": {
        const prompt = buildExplainConditionPrompt(questionContext, userContext);
        const text = await callGemini(prompt.system, prompt.user);
        return NextResponse.json({
          action: "explain",
          text,
        });
      }

      case "why_formula": {
        const prompt = buildWhyFormulaPrompt(questionContext, userContext);
        const text = await callGemini(prompt.system, prompt.user);
        return NextResponse.json({
          action: "why_formula",
          text,
        });
      }

      case "check_steps":
      case "where_mistake": {
        const prompt = buildCheckStepsPrompt(
          questionContext,
          userContext,
          data.userMessage
        );
        const text = await callGemini(prompt.system, prompt.user);
        return NextResponse.json({
          action: data.action,
          text,
        });
      }

      case "explain_topic": {
        const system = getBaseSystemPrompt(lang, masteryScore);
        const userPrompt = `Тема: ${topicRecord?.name || questionContext.topicName}
Объясни эту тему с нуля для подготовки к ЕНТ ТиПО:
1. Главная суть темы простыми словами.
2. 2-3 ключевые формулы/правила, которые нужно знать наизусть.
3. Типичная задача из ЕНТ и как к ней подступиться.
Будь краток, лаконичен и структурирован.`;
        const text = await callGemini(system, userPrompt);
        return NextResponse.json({
          action: "explain_topic",
          text,
        });
      }

      case "explain_formula": {
        const formulaLatex =
          data.formulaLatex || questionRecord?.latex || "a^m \\cdot a^n = a^{m+n}";
        const topicName = topicRecord?.name || questionContext.topicName;
        const prompt = buildExplainFormulaPrompt(
          formulaLatex,
          data.formulaName,
          topicName,
          userContext
        );
        const text = await callGemini(prompt.system, prompt.user);
        return NextResponse.json({
          action: "explain_formula",
          text,
        });
      }

      case "analyze_error": {
        const prompt = buildErrorAnalysisPrompt(questionContext, userContext);
        const rawJson = await callGemini(prompt.system, prompt.user, {
          jsonMode: true,
          temperature: 0.2,
        });

        let parsed: any;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          // Clean JSON markdown blocks if present
          const cleaned = rawJson.replace(/```json\s*|```/g, "").trim();
          parsed = JSON.parse(cleaned);
        }

        const validated = aiErrorAnalysisSchema.safeParse(parsed);
        const analysis = validated.success
          ? validated.data
          : {
              errorType: "concept_error",
              weakSkill: "general_math",
              reason: parsed.reason || "Ошибка в применении правила",
              shortExplanation:
                parsed.shortExplanation ||
                questionRecord?.explanation ||
                "Обратите внимание на последовательность действий.",
              hint: parsed.hint || "Внимательно проверьте условие и промежуточные вычисления.",
              recommendedAction: "practice" as const,
              recommendedDifficulty: questionContext.difficulty,
            };

        // Persist error analysis in Mistake record
        if (questionRecord) {
          try {
            if (data.attemptId) {
              // Update existing mistake for this attempt if exists, otherwise create
              const existingMistake = await prisma.mistake.findFirst({
                where: { attemptId: data.attemptId, userId },
              });

              if (existingMistake) {
                await prisma.mistake.update({
                  where: { id: existingMistake.id, userId },
                  data: {
                    weakSkill: analysis.weakSkill,
                    errorType: analysis.errorType,
                    explanation: analysis.shortExplanation,
                    aiReason: analysis.reason,
                    aiHint: analysis.hint,
                    userAnswer: data.userAnswer || existingMistake.userAnswer,
                    correctAnswer: questionRecord.correctAnswer,
                  },
                });
              } else {
                await prisma.mistake.create({
                  data: {
                    userId,
                    questionId: questionRecord.id,
                    attemptId: data.attemptId,
                    topicId: questionRecord.topicId,
                    subtopicId: questionRecord.subtopicId,
                    errorType: analysis.errorType,
                    weakSkill: analysis.weakSkill,
                    explanation: analysis.shortExplanation,
                    aiReason: analysis.reason,
                    aiHint: analysis.hint,
                    userAnswer: data.userAnswer,
                    correctAnswer: questionRecord.correctAnswer,
                    description: questionRecord.explanation,
                  },
                });
              }
            } else {
              // Create mistake entry without attemptId
              await prisma.mistake.create({
                data: {
                  userId,
                  questionId: questionRecord.id,
                  topicId: questionRecord.topicId,
                  subtopicId: questionRecord.subtopicId,
                  errorType: analysis.errorType,
                  weakSkill: analysis.weakSkill,
                  explanation: analysis.shortExplanation,
                  aiReason: analysis.reason,
                  aiHint: analysis.hint,
                  userAnswer: data.userAnswer,
                  correctAnswer: questionRecord.correctAnswer,
                  description: questionRecord.explanation,
                },
              });
            }
          } catch (dbErr) {
            console.error("Failed to persist mistake analysis to DB:", dbErr);
          }
        }

        return NextResponse.json({
          action: "analyze_error",
          structuredError: analysis,
          text: analysis.shortExplanation,
        });
      }

      case "similar_question": {
        const prompt = buildSimilarQuestionPrompt(questionContext, userContext);
        const rawJson = await callGemini(prompt.system, prompt.user, {
          jsonMode: true,
          temperature: 0.4,
        });

        let parsed: any;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          const cleaned = rawJson.replace(/```json\s*|```/g, "").trim();
          parsed = JSON.parse(cleaned);
        }

        const validated = aiSimilarQuestionSchema.safeParse(parsed);
        const similarQuestion = validated.success
          ? validated.data
          : {
              title: parsed.title || "Похожая тренировочная задача",
              questionText: parsed.questionText || "Вычислите значение выражения",
              latex: parsed.latex || questionContext.latex,
              hint: parsed.hint || "Примените то же правило, что и в основной задаче",
              expectedAnswer: parsed.expectedAnswer || "",
              explanation: parsed.explanation || "",
            };

        return NextResponse.json({
          action: "similar_question",
          similarQuestion,
        });
      }

      case "chat": {
        const userMsg = data.userMessage || "Помоги разобраться с этой задачей.";
        const prompt = buildChatPrompt(questionContext, userContext, userMsg);
        const text = await callGemini(prompt.system, prompt.user);
        return NextResponse.json({
          action: "chat",
          text,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("AI Tutor endpoint error:", error);
    const lang = "ru";
    return NextResponse.json(
      {
        error: FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES.ru,
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
