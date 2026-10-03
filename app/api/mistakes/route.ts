import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { searchParams } = new URL(request.url);

    const topicId = searchParams.get("topicId");
    const errorType = searchParams.get("errorType");
    const isReviewedStr = searchParams.get("isReviewed");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const where: any = { userId };
    if (topicId) where.topicId = topicId;
    if (errorType) where.errorType = errorType;
    if (isReviewedStr !== null) where.isReviewed = isReviewedStr === "true";

    const mistakes = await prisma.mistake.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        question: {
          include: {
            topic: true,
            steps: { orderBy: { order: "asc" } },
          },
        },
        attempt: {
          include: {
            stepAnswers: true,
          },
        },
      },
    });

    const total = await prisma.mistake.count({ where });

    // Aggregated weak skills for user
    const allUserMistakes = await prisma.mistake.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        topic: true,
        question: true,
      },
    });

    const topicProgresses = await prisma.userTopicProgress.findMany({
      where: { userId },
    });
    const progressMap = new Map<string, number>();
    for (const tp of topicProgresses) {
      progressMap.set(tp.topicId, tp.masteryScore);
    }

    // Group by skill key (weakSkill or fallback errorType)
    const skillGroups = new Map<
      string,
      {
        skillKey: string;
        skillName: string;
        topicId: string;
        topicName: string;
        count: number;
        lastMistakeAt: Date;
        lastQuestionTitle: string;
        lastExplanation?: string | null;
        masteryScore: number;
      }
    >();

    for (const m of allUserMistakes) {
      const key = m.weakSkill || m.errorType || m.topic?.name || "math_skill";
      const existing = skillGroups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        skillGroups.set(key, {
          skillKey: key,
          skillName: m.weakSkill || m.errorType,
          topicId: m.topicId,
          topicName: m.topic?.name || "Математика",
          count: 1,
          lastMistakeAt: m.createdAt,
          lastQuestionTitle: m.question?.title || "Задание",
          lastExplanation: m.explanation || m.description,
          masteryScore: progressMap.get(m.topicId) ?? 50,
        });
      }
    }

    const weakSkills = Array.from(skillGroups.values()).sort(
      (a, b) => b.count - a.count
    );

    return NextResponse.json({
      mistakes,
      weakSkills,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/mistakes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
