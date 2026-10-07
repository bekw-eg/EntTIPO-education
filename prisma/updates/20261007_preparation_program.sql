-- Additive and repeatable. Existing roads, exams, attempts and offline queues remain intact.
BEGIN;
ALTER TABLE "DiagnosticSession" ADD COLUMN IF NOT EXISTS "questionSnapshots" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "LearningRoadBlock" ADD COLUMN IF NOT EXISTS "programVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LearningRoadBlock" ADD COLUMN IF NOT EXISTS "policy" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "LearningRoadBlock" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "LearningRoadBlock" ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL DEFAULT 'initial';
ALTER TABLE "LearningRoadBlock" ADD COLUMN IF NOT EXISTS "sourceExamId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "LearningRoadBlock_sourceExamId_key" ON "LearningRoadBlock"("sourceExamId");
ALTER TABLE "LearningRoadNode" ADD COLUMN IF NOT EXISTS "phase" TEXT NOT NULL DEFAULT 'check';
ALTER TABLE "LearningRoadNode" ADD COLUMN IF NOT EXISTS "skillIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LearningRoadNode" ADD COLUMN IF NOT EXISTS "repairSkillIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LearningRoadNode" ADD COLUMN IF NOT EXISTS "evidence" JSONB;
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "roadNodeId" TEXT REFERENCES "LearningRoadNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ExamSession_roadNodeId_idx" ON "ExamSession"("roadNodeId");
COMMIT;
