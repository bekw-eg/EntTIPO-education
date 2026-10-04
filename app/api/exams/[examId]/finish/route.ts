import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { finishExam } from "@/lib/exam/session";
import { finishExamSchema } from "@/lib/exam/mode";
import { examError } from "@/lib/exam/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ examId: string }> }) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    finishExamSchema.parse(await request.json());
    return NextResponse.json(await finishExam(userId, (await context.params).examId));
  } catch (e) { return examError(e); }
}
