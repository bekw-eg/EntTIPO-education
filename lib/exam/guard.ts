import type { Prisma } from "@prisma/client";
import { PracticeError } from "../practiceStorage";

/** Also blocks generic AI messages and previously saved answer keys. Expired exams must first finalize. */
export async function assertNoActiveExam(tx: Prisma.TransactionClient, userId: string, allowDiagnostic = false) {
  if (await tx.examSession.count({ where: { userId, status: "active" } })) {
    throw new PracticeError("Во время экзамена подсказки, AI-помощь и промежуточная проверка недоступны. Завершите экзамен или откройте его после истечения времени.", 403);
  }
  if (!allowDiagnostic) await assertNoActiveDiagnostic(tx, userId);
}

export async function assertNoActiveDiagnostic(tx: Prisma.TransactionClient, userId: string) {
  if (await tx.diagnosticSession.count({ where: { userId, status: "active" } })) {
    throw new PracticeError("preparation_diagnostic_active", 403);
  }
}
