CREATE TABLE IF NOT EXISTS "OfflinePackage" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "sessionId" TEXT NOT NULL UNIQUE REFERENCES "PracticeSession"("id") ON DELETE CASCADE,
  "language" TEXT NOT NULL,
  "contentVersion" TEXT NOT NULL,
  "selectionHash" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OfflinePackage_userId_createdAt_idx" ON "OfflinePackage"("userId", "createdAt");
