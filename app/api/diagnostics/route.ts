import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { startDiagnostic } from "@/lib/diagnostics";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try { return NextResponse.json(await startDiagnostic(userId)); }
  catch (error) {
    if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Could not start diagnostic", error);
    return NextResponse.json({ error: "Could not start diagnostic" }, { status: 500 });
  }
}
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  const sessions = await prisma.diagnosticSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" },
    select: { id: true, status: true, currentIndex: true, startedAt: true, completedAt: true } });
  return NextResponse.json(sessions);
}
