import { localizedJson } from "@/lib/i18n/http";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { readUserSkills, recommendSkillQuestion } from "@/lib/skillProgress";
import { assertNoActiveExam } from "@/lib/exam/guard";
import { PracticeError } from "@/lib/practiceStorage";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse(request);
  try {
    await assertNoActiveExam(prisma, userId);
    const skills = await readUserSkills(prisma, userId);
    return localizedJson(request, await Promise.all(skills.map(async (skill) => ({ ...skill,
      recommendation: await recommendSkillQuestion(prisma, userId, skill.id) }))));
  } catch (error) {
    if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
    console.error("Could not read skills", error);
    return localizedJson(request, { error: "Could not load skills" }, { status: 500 });
  }
}
