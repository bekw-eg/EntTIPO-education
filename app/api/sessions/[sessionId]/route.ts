import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { summarizeAttempts } from "@/lib/practiceStats";
import { readPracticeSnapshot } from "@/lib/practiceSession";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    const { sessionId } = await context.params;

    const snapshot = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      return readPracticeSnapshot(tx, sessionId, userId);
    }, { maxWait: 10000, timeout: 10000 });
    return localizedJson(request, snapshot);
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Error in GET /api/sessions/[sessionId]:", error);
    return localizedJson(request, { error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = getCurrentUserId(request);
    if (!userId) return unauthorizedResponse(request);
    const { sessionId } = await context.params;

    const session = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      const owned = await tx.practiceSession.findFirst({ where: { id: sessionId, userId } });
      if (!owned) throw new PracticeError("Session not found", 404);
      if (owned.mode === "offline_practice") throw new PracticeError("Use offline synchronization for this training", 409);
      const attempts = await tx.userAttempt.findMany({
        where: { userId, sessionId }, select: { questionId: true, isCorrect: true },
      });
      const stats = summarizeAttempts(attempts);
      const saved = await tx.practiceSession.update({
        where: { id: sessionId, userId },
        data: { status: "completed", completedAt: owned.completedAt || new Date(),
          completedCount: stats.completedCount, correctCount: stats.correctCount,
          draftAnswers: {}, revision: { increment: 1 } },
      });
      const { choiceSnapshots: _privateChoices, legacyDraftAnswers: _legacyDraft, ...publicSession } = saved;
      return { ...publicSession, ...stats };
    }, { maxWait: 10000, timeout: 10000 });

    return localizedJson(request, session);
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Error in PATCH /api/sessions/[sessionId]:", error);
    return localizedJson(request, { error: "Internal server error" }, { status: 500 });
  }
}
