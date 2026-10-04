BEGIN;

ALTER TABLE "PracticeSession"
  ADD COLUMN IF NOT EXISTS "questionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "currentIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "draftAnswers" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currentAttemptId" TEXT;

-- Older sessions never saved their selection. Retain attempted questions first,
-- then fill available places from the same topic, without deleting any history.
-- Only empty lists are repaired, so rerunning this file preserves new sessions.
WITH selected AS (
  SELECT s."id", ARRAY(
    SELECT q."id" FROM "Question" q
    LEFT JOIN (
      SELECT "questionId", MIN("createdAt") AS first_answer
      FROM "UserAttempt" WHERE "sessionId" = s."id" GROUP BY "questionId"
    ) a ON a."questionId" = q."id"
    WHERE a.first_answer IS NOT NULL OR s."topicId" IS NULL OR q."topicId" = s."topicId"
    ORDER BY (a.first_answer IS NULL), a.first_answer, q."createdAt", q."id"
    LIMIT s."totalCount"
  ) AS ids,
  (SELECT COUNT(DISTINCT "questionId") FROM "UserAttempt" WHERE "sessionId" = s."id") AS answered
  FROM "PracticeSession" s WHERE cardinality(s."questionIds") = 0
), positioned AS (
  SELECT *, LEAST(answered, GREATEST(0, cardinality(ids) - 1))::INTEGER AS position FROM selected
)
UPDATE "PracticeSession" s SET
  "questionIds" = p.ids,
  "totalCount" = cardinality(p.ids),
  "currentIndex" = p.position,
  "currentAttemptId" = (
    SELECT a."id" FROM "UserAttempt" a
    WHERE a."sessionId" = s."id" AND a."questionId" = p.ids[p.position + 1]
    ORDER BY a."createdAt" DESC, a."id" DESC LIMIT 1
  )
FROM positioned p WHERE s."id" = p."id";

COMMIT;
