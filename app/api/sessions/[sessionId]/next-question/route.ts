import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { practiceQuestionSelect, publicPracticeQuestion } from "@/lib/practiceSession";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { sessionId } = await context.params;
    const session = await prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, hintedQuestionIds: true, questionIds: true, currentIndex: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const index = Number(searchParams.get("index") ?? session.currentIndex);
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "Invalid question index" }, { status: 400 });
    }

    if (!session.questionIds[index]) {
      return NextResponse.json(
        { error: "No question found at this index" },
        { status: 404 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: session.questionIds[index] },
      select: practiceQuestionSelect,
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(publicPracticeQuestion(question, session.hintedQuestionIds.includes(question.id)));
  } catch (error) {
    console.error("Error in GET /api/sessions/[sessionId]/next-question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
