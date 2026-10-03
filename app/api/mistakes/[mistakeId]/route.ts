import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mistakeId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { mistakeId } = await context.params;
    const body = await request.json();

    if (typeof body.isReviewed !== "boolean") {
      return NextResponse.json(
        { error: "isReviewed must be a boolean" },
        { status: 400 }
      );
    }

    const updated = await prisma.mistake.updateMany({
      where: { id: mistakeId, userId },
      data: {
        isReviewed: body.isReviewed,
        reviewedAt: body.isReviewed ? new Date() : null,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Mistake not found" }, { status: 404 });
    }
    const mistake = await prisma.mistake.findFirst({
      where: { id: mistakeId, userId },
    });

    return NextResponse.json(mistake);
  } catch (error) {
    console.error("Error in PATCH /api/mistakes/[mistakeId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
