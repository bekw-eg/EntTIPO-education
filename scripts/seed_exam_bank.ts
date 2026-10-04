import { PrismaClient } from "@prisma/client";
import { seedExamBank } from "../prisma/examSeed";
const prisma = new PrismaClient();
seedExamBank(prisma).then(() => console.log("Exam bank and reviewed skill links added; existing content preserved."))
  .catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
