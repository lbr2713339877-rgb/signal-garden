ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "contributors" integer NOT NULL DEFAULT 0;
