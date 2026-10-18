ALTER TABLE "project" ADD COLUMN "focus_themes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "focus_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "focus_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "focus_themes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "project_focus_idx" ON "project" USING btree ("focus_score");