BEGIN;
CREATE TABLE IF NOT EXISTS "ExamSession" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "startRequestId" TEXT NOT NULL, "startHash" TEXT NOT NULL,
  "profileId" TEXT NOT NULL, "profileVersion" TEXT NOT NULL, "language" TEXT NOT NULL,
  "profileSnapshot" JSONB NOT NULL, "paper" JSONB NOT NULL, "questionIds" TEXT[] NOT NULL,
  "answers" JSONB NOT NULL DEFAULT '{}', "flaggedQuestionIds" TEXT[] NOT NULL DEFAULT '{}',
  "currentIndex" INTEGER NOT NULL DEFAULT 0, "revision" INTEGER NOT NULL DEFAULT 0,
  "lastSaveId" TEXT, "lastSaveHash" TEXT, "status" TEXT NOT NULL DEFAULT 'active',
  "startedAt" TIMESTAMP(3) NOT NULL, "deadlineAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL, "completedAt" TIMESTAMP(3), "completionReason" TEXT, "result" JSONB,
  CHECK ("deadlineAt" > "startedAt"), CHECK ("currentIndex" >= 0), CHECK ("revision" >= 0),
  CHECK ("status" IN ('active', 'completed')),
  CHECK (("status" = 'active' AND "result" IS NULL) OR ("status" = 'completed' AND "result" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExamSession_userId_startRequestId_key" ON "ExamSession"("userId", "startRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamSession_one_active_per_user" ON "ExamSession"("userId") WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "ExamSession_userId_status_idx" ON "ExamSession"("userId", "status");
ALTER TABLE "SkillObservation" ADD COLUMN IF NOT EXISTS "examSessionId" TEXT REFERENCES "ExamSession"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "SkillObservation_examSessionId_questionId_skillId_key" ON "SkillObservation"("examSessionId", "questionId", "skillId");
ALTER TABLE "Mistake" ADD COLUMN IF NOT EXISTS "examSessionId" TEXT REFERENCES "ExamSession"("id") ON DELETE CASCADE;
ALTER TABLE "DailyLearningPlan" ADD COLUMN IF NOT EXISTS "examId" TEXT;
COMMIT;
