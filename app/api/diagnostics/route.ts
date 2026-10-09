import { retiredServiceResponse } from "@/lib/retiredService";
import { localizedJson, requestLocale } from "@/lib/i18n/http";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { startDiagnostic } from "@/lib/diagnostics";
import { PracticeError } from "@/lib/practiceStorage";
import { z, ZodError } from "zod";

export const dynamic = "force-dynamic";
async function archivedPOST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    const text = await request.text();
    const data = z.object({ restartFromId: z.string().min(1).optional() }).strict().parse(text ? JSON.parse(text) : {});
    return localizedJson(request, await startDiagnostic(userId, data.restartFromId, requestLocale(request) === 'kk' ? 'kk' : 'ru'));
  }
  catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return localizedJson(request, { error: "Invalid diagnostic start" }, { status: 400 });
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Could not start diagnostic", error);
    return localizedJson(request, { error: "Could not start diagnostic" }, { status: 500 });
  }
}
async function archivedGET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  const sessions = await prisma.diagnosticSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" },
    select: { id: true, status: true, currentIndex: true, startedAt: true, completedAt: true } });
  return localizedJson(request, sessions);
}

export async function POST() { return retiredServiceResponse(); }
export async function GET() { return retiredServiceResponse(); }
