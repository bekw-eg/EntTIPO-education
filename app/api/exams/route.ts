import { localizedJson } from "@/lib/i18n/http";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { listExams, startExam } from "@/lib/exam/session";
import { startExamSchema } from "@/lib/exam/mode";
import { examError } from "@/lib/exam/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await listExams(userId)); } catch (e) { return examError(e, request); }
}
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try { return localizedJson(request, await startExam(userId, startExamSchema.parse(await request.json()))); } catch (e) { return examError(e, request); }
}
