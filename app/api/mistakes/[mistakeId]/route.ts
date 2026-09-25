import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mistakeId: string }> }
) {
  try {
    const userId = getCurrentUserId();
    const { mistakeId } = await context.params;
    const body = await request.json();

    if (typeof body.isReviewed !== "boolean") {
      return NextResponse.json(
        { error: "isReviewed must be a boolean" },
        { status: 400 }
      );
    }

    const mistake = await prisma.mistake.update({
      where: { id: mistakeId, userId },
      data: {
        isReviewed: body.isReviewed,
        reviewedAt: body.isReviewed ? new Date() : null,
      },
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
