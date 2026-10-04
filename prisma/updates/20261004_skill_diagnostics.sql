-- Stage 4. Additive, transactional, safe to apply again. No historical inference.
BEGIN;
SELECT pg_advisory_xact_lock(410041);
DO $migration$
BEGIN
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Skill') THEN
-- AlterTable
ALTER TABLE "Mistake" ADD COLUMN     "skillId" TEXT,
ADD COLUMN     "stepId" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "explanationKk" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'practice',
ADD COLUMN     "questionTextKk" TEXT,
ADD COLUMN     "titleKk" TEXT;

-- AlterTable
ALTER TABLE "QuestionStep" ADD COLUMN     "misconceptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "promptKk" TEXT;

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT NOT NULL,
    "explanationRu" TEXT NOT NULL,
    "explanationKk" TEXT NOT NULL,
    "ruleRu" TEXT NOT NULL,
    "ruleKk" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionSkill" (
    "questionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "QuestionSkill_pkey" PRIMARY KEY ("questionId","skillId")
);

-- CreateTable
CREATE TABLE "StepSkill" (
    "stepId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "StepSkill_pkey" PRIMARY KEY ("stepId","skillId")
);

-- CreateTable
CREATE TABLE "SkillObservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptId" TEXT,
    "diagnosticAnswerId" TEXT,
    "score" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "isPartial" BOOLEAN NOT NULL,
    "usedHint" BOOLEAN NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkillProgress" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "observationCount" INTEGER NOT NULL,
    "distinctQuestions" INTEGER NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkillProgress_pkey" PRIMARY KEY ("userId","skillId")
);

-- CreateTable
CREATE TABLE "DiagnosticSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "questionIds" TEXT[],
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "draftAnswers" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiagnosticSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "submissionHash" TEXT NOT NULL,
    "stepResults" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionSkill_skillId_idx" ON "QuestionSkill"("skillId");

-- CreateIndex
CREATE INDEX "SkillObservation_userId_skillId_createdAt_idx" ON "SkillObservation"("userId", "skillId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillObservation_attemptId_skillId_key" ON "SkillObservation"("attemptId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillObservation_diagnosticAnswerId_skillId_key" ON "SkillObservation"("diagnosticAnswerId", "skillId");

-- CreateIndex
CREATE INDEX "DiagnosticSession_userId_startedAt_idx" ON "DiagnosticSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticAnswer_sessionId_questionId_key" ON "DiagnosticAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticAnswer_sessionId_submissionId_key" ON "DiagnosticAnswer"("sessionId", "submissionId");

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "QuestionStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkill" ADD CONSTRAINT "QuestionSkill_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkill" ADD CONSTRAINT "QuestionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepSkill" ADD CONSTRAINT "StepSkill_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "QuestionStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepSkill" ADD CONSTRAINT "StepSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillObservation" ADD CONSTRAINT "SkillObservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillObservation" ADD CONSTRAINT "SkillObservation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillObservation" ADD CONSTRAINT "SkillObservation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "UserAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillObservation" ADD CONSTRAINT "SkillObservation_diagnosticAnswerId_fkey" FOREIGN KEY ("diagnosticAnswerId") REFERENCES "DiagnosticAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticSession" ADD CONSTRAINT "DiagnosticSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAnswer" ADD CONSTRAINT "DiagnosticAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiagnosticSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAnswer" ADD CONSTRAINT "DiagnosticAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

END IF;
END
$migration$;
COMMIT;