-- Stage 5: additive, transactional and idempotent. Legacy isReviewed remains a viewing flag.
BEGIN;
SELECT pg_advisory_xact_lock(510041);
DO $migration$
BEGIN
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'DailyLearningPlan') THEN
-- AlterTable
ALTER TABLE "Mistake" ADD COLUMN     "confirmationAttemptId" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timeZone" TEXT;

-- CreateTable
CREATE TABLE "DailyLearningPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "diagnosticId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlanAction" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "skillId" TEXT,
    "mistakeId" TEXT,
    "questionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ready',
    "sessionId" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LearningPlanAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "mistakeId" TEXT,
    "questionId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptId" TEXT,
    "purpose" TEXT NOT NULL,
    "reviewVersion" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LearningCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillReview" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "intervalIndex" INTEGER NOT NULL DEFAULT 0,
    "dueDay" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "QuestionHelp" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionHelp_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyLearningPlan_userId_day_key" ON "DailyLearningPlan"("userId", "day");

-- CreateIndex
CREATE INDEX "LearningPlanAction_planId_position_idx" ON "LearningPlanAction"("planId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCheck_sessionId_key" ON "LearningCheck"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningCheck_attemptId_key" ON "LearningCheck"("attemptId");

-- CreateIndex
CREATE INDEX "LearningCheck_userId_skillId_status_idx" ON "LearningCheck"("userId", "skillId", "status");

-- CreateIndex
CREATE INDEX "Mistake_userId_confirmedAt_createdAt_idx" ON "Mistake"("userId", "confirmedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_confirmationAttemptId_fkey" FOREIGN KEY ("confirmationAttemptId") REFERENCES "UserAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLearningPlan" ADD CONSTRAINT "DailyLearningPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanAction" ADD CONSTRAINT "LearningPlanAction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DailyLearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanAction" ADD CONSTRAINT "LearningPlanAction_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanAction" ADD CONSTRAINT "LearningPlanAction_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "Mistake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanAction" ADD CONSTRAINT "LearningPlanAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCheck" ADD CONSTRAINT "LearningCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCheck" ADD CONSTRAINT "LearningCheck_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCheck" ADD CONSTRAINT "LearningCheck_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "Mistake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCheck" ADD CONSTRAINT "LearningCheck_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCheck" ADD CONSTRAINT "LearningCheck_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCheck" ADD CONSTRAINT "LearningCheck_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "UserAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_lastAttemptId_fkey" FOREIGN KEY ("lastAttemptId") REFERENCES "UserAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionHelp" ADD CONSTRAINT "QuestionHelp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionHelp" ADD CONSTRAINT "QuestionHelp_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

END IF;
END
$migration$;
ALTER TABLE "LearningCheck" ADD COLUMN IF NOT EXISTS "targetDifficulty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DiagnosticSession" ADD COLUMN IF NOT EXISTS "restartFromId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "DiagnosticSession_userId_restartFromId_key" ON "DiagnosticSession"("userId", "restartFromId");
COMMIT;
