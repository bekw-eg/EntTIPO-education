import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EXAM_PROFILES, getExamProfile, TIPO_MATH } from "@/lib/exam/profile";
import { readCoverage } from "@/lib/exam/database";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!getCurrentUserId(request)) return unauthorizedResponse();
  const profile = getExamProfile(new URL(request.url).searchParams.get("profile") ?? TIPO_MATH.id);
  if (!profile) return NextResponse.json({ error: "Unknown exam profile", profiles: EXAM_PROFILES.map((p) => p.id) }, { status: 404 });
  try { return NextResponse.json(await readCoverage(prisma, profile)); }
  catch (error) {
    console.error("Coverage audit failed", error);
    return NextResponse.json({ error: "Не удалось проверить фактический банк задач" }, { status: 500 });
  }
}
