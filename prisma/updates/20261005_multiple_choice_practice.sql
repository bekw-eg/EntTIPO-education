-- Additive and repeatable. Keep every old answer, step, exam and user row.
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "practiceChoice" JSONB;
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "choiceSnapshots" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PracticeSession" ADD COLUMN IF NOT EXISTS "legacyDraftAnswers" JSONB NOT NULL DEFAULT '{}';
UPDATE "PracticeSession" SET "legacyDraftAnswers" = "draftAnswers"
WHERE "legacyDraftAnswers" = '{}' AND "draftAnswers" <> '{}'
  AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys("draftAnswers") AS k WHERE k LIKE 'choice:%');
