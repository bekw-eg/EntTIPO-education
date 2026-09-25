import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { sessionId } = await context.params;

    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId, userId },
      include: {
        attempts: {
          select: { id: true, questionId: true, isCorrect: true, createdAt: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let topic = null;
    if (session.topicId) {
      topic = await prisma.topic.findUnique({
        where: { id: session.topicId },
      });
    }

    return NextResponse.json({ ...session, topic });
  } catch (error) {
    console.error("Error in GET /api/sessions/[sessionId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { sessionId } = await context.params;

    const session = await prisma.practiceSession.update({
      where: { id: sessionId, userId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error in PATCH /api/sessions/[sessionId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
