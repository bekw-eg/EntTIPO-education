import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

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
      select: { id: true, hintedQuestionIds: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const questionIds = searchParams.get("questionIds")?.split(",") ?? [];
    const index = parseInt(searchParams.get("index") ?? "0", 10);

    if (!questionIds[index]) {
      return NextResponse.json(
        { error: "No question found at this index" },
        { status: 404 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionIds[index] },
      include: {
        topic: true,
        subtopic: true,
        steps: {
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...question, usedHint: session.hintedQuestionIds.includes(question.id) });
  } catch (error) {
    console.error("Error in GET /api/sessions/[sessionId]/next-question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
