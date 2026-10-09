-- Additive. ExamSession remains the authoritative atomic reservation ledger.
-- Its existing (userId,status) index has userId as its leading column and
-- already supports unfiltered historical-paper reads for one account.
CREATE TABLE IF NOT EXISTS "ExamBankAudit" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS "ExamBankAudit_userId_createdAt_idx"
ON "ExamBankAudit" ("userId", "createdAt");

-- Every successful start request is remembered, including the second tab's
-- request that resumed the active paper. Retrying it after completion must
-- still return that paper, not allocate a new one.
CREATE TABLE IF NOT EXISTS "ExamStartRequest" (
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "examId" TEXT NOT NULL REFERENCES "ExamSession"("id") ON DELETE CASCADE,
  "startHash" TEXT NOT NULL,
  PRIMARY KEY ("userId", "requestId")
);
CREATE INDEX IF NOT EXISTS "ExamStartRequest_examId_idx" ON "ExamStartRequest" ("examId");
