import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getExamProfile, TIPO_MATH } from "../lib/exam/profile";
import { readCoverage } from "../lib/exam/database";
const prisma = new PrismaClient();
async function main() {
  const profile = getExamProfile(process.argv[2] ?? TIPO_MATH.id);
  if (!profile) throw new Error("Unknown exam profile");
  const output = path.resolve(process.argv[3] ?? "docs/exam-coverage-report.json");
  const report = await readCoverage(prisma, profile);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2) + "\n");
  console.log(JSON.stringify({ profile: `${profile.id}@${profile.version}`, output, totals: report.totals,
    readiness: report.readiness }, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
