import { retiredServiceResponse } from "@/lib/retiredService";
import { localizedJson } from "@/lib/i18n/http";
import { prisma } from "@/lib/prisma";
import { EXAM_PROFILES, getExamProfile, TIPO_MATH } from "@/lib/exam/profile";
import { readCoverage } from "@/lib/exam/database";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";

export const dynamic = "force-dynamic";
async function archivedGET(request: Request) {
  if (!getCurrentUserId(request)) return unauthorizedResponse(request);
  const profile = getExamProfile(new URL(request.url).searchParams.get("profile") ?? TIPO_MATH.id);
  if (!profile) return localizedJson(request, { error: "Unknown exam profile", profiles: EXAM_PROFILES.map((p) => p.id) }, { status: 404 });
  const language = new URL(request.url).searchParams.get('language') === 'kk' ? 'kk' : 'ru';
  try { return localizedJson(request, await readCoverage(prisma, profile, language)); }
  catch (error) {
    console.error("Coverage audit failed", error);
    return localizedJson(request, { error: "Не удалось проверить фактический банк задач" }, { status: 500 });
  }
}

export async function GET() { return retiredServiceResponse(); }
