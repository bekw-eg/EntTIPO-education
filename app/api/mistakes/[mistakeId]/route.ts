import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { z, ZodError } from "zod";
import { lockAccount, PracticeError } from "@/lib/practiceStorage";
import { assertNoActiveExam } from "@/lib/exam/guard";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mistakeId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse();
    const { mistakeId } = await context.params;
    const body = z.object({ isReviewed: z.boolean() }).strict().parse(await request.json());
    const mistake = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      const existing = await tx.mistake.findFirst({ where: { id: mistakeId, userId } });
      if (!existing) throw new PracticeError("Mistake not found", 404);
      if (existing.isReviewed === body.isReviewed) return existing;
      return tx.mistake.update({ where: { id: mistakeId }, data: { isReviewed: body.isReviewed,
        reviewedAt: body.isReviewed ? new Date() : null } });
    });

    return NextResponse.json(mistake);
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Only a viewing flag may be changed manually" }, { status: 400 });
    console.error("Error in PATCH /api/mistakes/[mistakeId]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
