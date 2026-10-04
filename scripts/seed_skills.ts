import { PrismaClient } from "@prisma/client";
import { seedSkills } from "../prisma/skillSeed";

const prisma = new PrismaClient();
seedSkills(prisma).then(() => console.log("Skill catalog and exercises added; existing history preserved."))
  .catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
