import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { listExams, startExam } from "@/lib/exam/session";
import { startExamSchema } from "@/lib/exam/mode";
import { examError } from "@/lib/exam/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try { return NextResponse.json(await listExams(userId)); } catch (e) { return examError(e); }
}
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try { return NextResponse.json(await startExam(userId, startExamSchema.parse(await request.json()))); } catch (e) { return examError(e); }
}
