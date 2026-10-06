import { PrismaClient } from "@prisma/client";
import { seedPracticeChoices } from "../prisma/practiceChoiceSeed";
const prisma = new PrismaClient();
seedPracticeChoices(prisma).then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error(error); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
