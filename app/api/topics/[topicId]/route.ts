import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { topicId } = await context.params;

    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        lesson: true,
        subtopics: true,
        progress: {
          where: { userId },
        },
        _count: { select: { questions: true } },
      },
    });

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const topicWithProgress = {
      ...topic,
      masteryScore: topic.progress[0]?.masteryScore ?? 0,
      currentLevel: topic.progress[0]?.currentLevel ?? 1,
    };

    return NextResponse.json(topicWithProgress);
  } catch (error) {
    console.error("Error in GET /api/topics/[topicId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
