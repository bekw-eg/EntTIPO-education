import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { lockAccount, PracticeError } from "@/lib/practiceStorage";
import { startLearningCheck } from "@/lib/learningChecks";

export async function POST(request: Request, context: { params: Promise<{ mistakeId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    const { mistakeId } = await context.params;
    const result = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      const mistake = await tx.mistake.findFirst({ where: { id: mistakeId, userId } });
      if (!mistake) throw new PracticeError("Mistake not found", 404);
      if (!mistake.skillId) return { unavailable: true, reason: "unmapped_skill" };
      // Exclude the day's reserved practice so checking from either screen preserves independence.
      const practice = await tx.learningPlanAction.findMany({ where: { kind: "practice", plan: { userId, status: "active" } }, select: { questionIds: true } });
      const check = await startLearningCheck(tx, userId, { skillId: mistake.skillId, mistakeId, excluded: practice.flatMap((a) => a.questionIds) });
      return check ? { href: `/practice/session/${check.sessionId}`, checkId: check.id } : { unavailable: true, reason: "no_similar_question" };
    }, { maxWait: 10000, timeout: 20000 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Could not start mistake check", error);
    return NextResponse.json({ error: "Could not start mistake check" }, { status: 500 });
  }
}
