BEGIN;
CREATE TABLE IF NOT EXISTS "LearningRoadBlock" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "sequence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LearningRoadBlock_userId_sequence_key" ON "LearningRoadBlock"("userId", "sequence");
ALTER TABLE "LearningRoadBlock" ADD COLUMN IF NOT EXISTS "diagnosticId" TEXT;
CREATE TABLE IF NOT EXISTS "LearningRoadNode" (
  "id" TEXT PRIMARY KEY,
  "blockId" TEXT NOT NULL REFERENCES "LearningRoadBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "position" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "skillId" TEXT NOT NULL REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "prerequisiteIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "questionCount" INTEGER NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL,
  "sessionId" TEXT REFERENCES "PracticeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "completedAt" TIMESTAMP(3),
  "unavailable" BOOLEAN NOT NULL DEFAULT false,
  "skipped" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS "LearningRoadNode_blockId_position_key" ON "LearningRoadNode"("blockId", "position");
CREATE INDEX IF NOT EXISTS "LearningRoadNode_sessionId_idx" ON "LearningRoadNode"("sessionId");
COMMIT;
