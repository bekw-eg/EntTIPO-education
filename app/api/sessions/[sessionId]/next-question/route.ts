import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { practiceQuestionSelect, publicPracticeQuestion } from "@/lib/practiceSession";
import { assertNoActiveExam } from "@/lib/exam/guard";
import { lockAccount, PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { sessionId } = await context.params;
    const result = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      const session = await tx.practiceSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, hintedQuestionIds: true, questionIds: true, currentIndex: true },
      });
      if (!session) throw new PracticeError("Session not found", 404);
      const { searchParams } = new URL(request.url);
      const index = Number(searchParams.get("index") ?? session.currentIndex);
      if (!Number.isInteger(index) || index < 0) throw new PracticeError("Invalid question index", 400);
      if (!session.questionIds[index]) throw new PracticeError("No question found at this index", 404);

      const question = await tx.question.findUnique({
        where: { id: session.questionIds[index] },
        select: practiceQuestionSelect,
      });
      if (!question) throw new PracticeError("Question not found", 404);
      return publicPracticeQuestion(question, session.hintedQuestionIds.includes(question.id));
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error in GET /api/sessions/[sessionId]/next-question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
