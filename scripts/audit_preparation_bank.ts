import { PrismaClient } from "@prisma/client";
import { PREPARATION_POLICY } from "../lib/learning-road/program-policy";
import { contentKey } from "../lib/learning-road/program-bank";
import { choiceSchema } from "../lib/practiceChoice";

const prisma = new PrismaClient();
async function main() {
  const skills = await prisma.skill.findMany({ orderBy: { id: "asc" } });
  const bank = await prisma.question.findMany({ where: { purpose: { in: ["practice", "verification"] } }, include: { skills: true, steps: { include: { skills: true } } } });
  const rows = skills.map(skill => {
    const candidates = bank.filter(q => {
      const c = choiceSchema.safeParse(q.practiceChoice);
      return c.success && c.data.type === "single" && c.data.skillIds.includes(skill.id) && q.skills.some(l => l.skillId === skill.id) && q.steps.some(s => s.skills.some(l => l.skillId === skill.id));
    });
    const unique = new Set(candidates.map(q => contentKey(choiceSchema.parse(q.practiceChoice).questionText))).size;
    return { skillId: skill.id, distinctStems: unique, minimumFirstCheckAndMixed: PREPARATION_POLICY.blockSize + PREPARATION_POLICY.mixedPerSkill,
      enoughBeforeExposure: unique >= PREPARATION_POLICY.blockSize + PREPARATION_POLICY.mixedPerSkill };
  });
  console.log(JSON.stringify({ caveat: "Read-only content inventory; does not establish difficulty, breadth or independence of solution families. Diagnostics and prior exposure further reduce availability.", skills: rows }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
