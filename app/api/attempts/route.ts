import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { submitAttemptSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { assertNoActiveExam } from "@/lib/exam/guard";
import { submitAttempt } from "@/lib/submitAttempt";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    return localizedJson(request, await submitAttempt(userId, submitAttemptSchema.parse(await request.json())));
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: "Invalid attempt payload" }, { status: 400 });
    console.error("Error in POST /api/attempts:", error);
    return localizedJson(request, { error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    await assertNoActiveExam(prisma, userId);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return localizedJson(request, { error: "sessionId is required" }, { status: 400 });
    }

    const attempts = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await assertNoActiveExam(tx, userId);
      const session = await tx.practiceSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true },
      });
      if (!session) throw new PracticeError("Session not found", 404);

      return tx.userAttempt.findMany({
        where: { userId, sessionId },
        include: {
          question: { include: { topic: true } },
          stepAnswers: true,
        },
        orderBy: { createdAt: "asc" },
      });
    });

    return localizedJson(request, attempts);
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Error in GET /api/attempts:", error);
    return localizedJson(request, { error: "Internal server error" }, { status: 500 });
  }
}
