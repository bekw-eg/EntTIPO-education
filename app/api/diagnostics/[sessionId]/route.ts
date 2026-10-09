import { retiredServiceResponse } from "@/lib/retiredService";
import { localizedJson } from "@/lib/i18n/http";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { diagnosticDraftSchema, diagnosticQuestion, readDiagnosticSnapshot } from "@/lib/diagnostics";
import { PracticeError, lockAccount } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ sessionId: string }> };
function failure(error: unknown) {
  if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid diagnostic state" }, { status: 400 });
  console.error("Diagnostic state failed", error);
  return NextResponse.json({ error: "Could not load diagnostic" }, { status: 500 });
}
async function archivedGET(request: Request, context: Context) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const { sessionId } = await context.params;
    return localizedJson(request, await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      return readDiagnosticSnapshot(tx, sessionId, userId);
    }, { maxWait: 10000, timeout: 10000 }));
  } catch (error) { return failure(error); }
}
async function archivedPATCH(request: Request, context: Context) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const data = diagnosticDraftSchema.parse(await request.json());
    const { sessionId } = await context.params;
    const result = await prisma.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      const session = await tx.diagnosticSession.findFirst({ where: { id: sessionId, userId } });
      if (!session) throw new PracticeError("Diagnostic not found", 404);
      if (session.status !== "active" || session.revision !== data.revision || session.currentIndex !== data.currentIndex) throw new PracticeError("Diagnostic changed; reload the saved state", 409);
      const steps = (await diagnosticQuestion(tx, session, session.questionIds[session.currentIndex]))?.steps ?? [];
      if (Object.keys(data.answers).some((id) => !steps.some((s) => s.id === id))) throw new PracticeError("Answers must belong to the current question", 400);
      const saved = await tx.diagnosticSession.update({ where: { id: sessionId, userId }, data: {
        draftAnswers: data.answers, revision: { increment: 1 },
      } });
      return { revision: saved.revision };
    }, { maxWait: 10000, timeout: 10000 });
    return localizedJson(request, result);
  } catch (error) { return failure(error); }
}

export async function GET() { return retiredServiceResponse(); }
export async function PATCH() { return retiredServiceResponse(); }
