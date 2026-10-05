import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
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
      return localizedJson(request, { error: "Topic not found" }, { status: 404 });
    }

    const topicWithProgress = {
      ...topic,
      masteryScore: topic.progress[0]?.masteryScore ?? 0,
      currentLevel: topic.progress[0]?.currentLevel ?? 1,
    };

    return localizedJson(request, topicWithProgress);
  } catch (error) {
    console.error("Error in GET /api/topics/[topicId]:", error);
    return localizedJson(request, { error: "Internal server error" }, { status: 500 });
  }
}
