-- Additive and repeatable. No answer keys, IDs, sessions or user history are rewritten.
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "nameKk" TEXT;
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "descriptionKk" TEXT;
ALTER TABLE "Subtopic" ADD COLUMN IF NOT EXISTS "nameKk" TEXT;
ALTER TABLE "Subtopic" ADD COLUMN IF NOT EXISTS "descriptionKk" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "localizationSource" TEXT;
ALTER TABLE "QuestionStep" ADD COLUMN IF NOT EXISTS "hintKk" TEXT;
ALTER TABLE "QuestionOption" ADD COLUMN IF NOT EXISTS "textKk" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "contentKk" JSONB;
ALTER TABLE "Mistake" ADD COLUMN IF NOT EXISTS "aiAnalysisLocales" JSONB NOT NULL DEFAULT '{}';
