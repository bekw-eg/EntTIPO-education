-- Additive update: existing attempts keep NULL submission IDs and their history.
BEGIN;
ALTER TABLE "PracticeSession"
  ADD COLUMN IF NOT EXISTS "hintedQuestionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserAttempt"
  ADD COLUMN IF NOT EXISTS "submissionId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionHash" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionResult" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "UserAttempt_userId_submissionId_key"
  ON "UserAttempt"("userId", "submissionId");
CREATE INDEX IF NOT EXISTS "UserAttempt_userId_createdAt_idx"
  ON "UserAttempt"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserAttempt_sessionId_questionId_idx"
  ON "UserAttempt"("sessionId", "questionId");
COMMIT;
