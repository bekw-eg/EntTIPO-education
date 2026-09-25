import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId();
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

    return NextResponse.json({
      mistakes,
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
