import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/user";
import { readUserSkills, recommendSkillQuestion } from "@/lib/skillProgress";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const userId = getCurrentUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    const skills = await readUserSkills(prisma, userId);
    return NextResponse.json(await Promise.all(skills.map(async (skill) => ({ ...skill,
      recommendation: await recommendSkillQuestion(prisma, userId, skill.id) }))));
  } catch (error) {
    console.error("Could not read skills", error);
    return NextResponse.json({ error: "Could not load skills" }, { status: 500 });
  }
}
