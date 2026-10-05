import { localizedJson } from "@/lib/i18n/http";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { readExam, saveExam } from "@/lib/exam/session";
import { saveExamSchema } from "@/lib/exam/mode";
import { examError } from "@/lib/exam/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ examId: string }> };
export async function GET(request: Request, context: Context) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await readExam(userId, (await context.params).examId)); } catch (e) { return examError(e, request); }
}
export async function PATCH(request: Request, context: Context) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await saveExam(userId, (await context.params).examId, saveExamSchema.parse(await request.json()))); } catch (e) { return examError(e, request); }
}
