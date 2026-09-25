import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    await context.params;
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

    return NextResponse.json(question);
  } catch (error) {
    console.error("Error in GET /api/sessions/[sessionId]/next-question:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
