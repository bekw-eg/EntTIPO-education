import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { practiceStateSchema } from "@/lib/validators";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";
import { readPracticeSnapshot } from "@/lib/practiceSession";

export async function PATCH(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const parsed = practiceStateSchema.safeParse(await request.json());
    if (!parsed.success) return localizedJson(request, { error: "Invalid practice state" }, { status: 400 });
    const data = parsed.data;
    const { sessionId } = await context.params;
    const result = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      const session = await tx.practiceSession.findFirst({ where: { id: sessionId, userId } });
      if (!session) throw new PracticeError("Session not found", 404);
      if (session.mode === "offline_practice") throw new PracticeError("Use offline synchronization for this training", 409);
      if (session.status !== "active") throw new PracticeError("Session is already completed", 409);
      if (session.revision !== data.revision) throw new PracticeError("Session changed; reload its latest state", 409);
      const questionId = session.questionIds[session.currentIndex];
      if (!questionId) throw new PracticeError("No question at this position", 409);

      if (data.action === "save") {
        if (session.currentAttemptId || session.currentIndex !== data.currentIndex) {
          throw new PracticeError("Question state changed; reload its latest state", 409);
        }
        const steps = await tx.questionStep.findMany({ where: { questionId }, select: { id: true } });
        const validSteps = new Set(steps.map((step) => step.id));
        if (Object.keys(data.answers).some((id) => !validSteps.has(id))) {
          throw new PracticeError("Answers must belong to the current question", 400);
        }
        const saved = await tx.practiceSession.update({ where: { id: sessionId, userId }, data: {
          draftAnswers: data.answers, revision: { increment: 1 },
        } });
        return { revision: saved.revision };
      }

      if (!session.currentAttemptId) throw new PracticeError("Check the solution before continuing", 409);
      const isLast = session.currentIndex + 1 >= session.questionIds.length;
      await tx.practiceSession.update({ where: { id: sessionId, userId }, data: {
        revision: { increment: 1 }, draftAnswers: {},
        ...(data.action === "retry" ? { currentAttemptId: null } : isLast
          ? { status: "completed", completedAt: new Date() }
          : { currentIndex: session.currentIndex + 1, currentAttemptId: null }),
      } });
      return readPracticeSnapshot(tx, sessionId, userId);
    }, { maxWait: 10000, timeout: 10000 });
    return localizedJson(request, result);
  } catch (error) {
    if (error instanceof SyntaxError) return localizedJson(request, { error: "Invalid JSON" }, { status: 400 });
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Could not update practice state:", error);
    return localizedJson(request, { error: "Could not save practice state" }, { status: 500 });
  }
}
