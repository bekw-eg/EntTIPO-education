import { prisma } from "@/lib/prisma";
import { TIPO_MATH } from "@/lib/exam/profile";
import { readExamAvailability } from "@/lib/exam/session";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { localizedJson } from "@/lib/i18n/http";
import { examError } from "@/lib/exam/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!getCurrentUserId(request)) return unauthorizedResponse(request);
  try {
    const languages = await prisma.$transaction(async tx => {
      const summaries = [];
      for (const language of ["ru", "kk"] as const) {
        const { readiness, shortages } = await readExamAvailability(tx, TIPO_MATH, language);
        summaries.push({ language, canGenerate: readiness.canGenerate,
          missingPointCodes: shortages.map(point => point.pointCode) });
      }
      return summaries;
    }, { timeout: 30000 });
    // No questions, answer keys, content hashes or internal audit data are public.
    return localizedJson(request, { languages });
  } catch (error) { return examError(error, request); }
}
