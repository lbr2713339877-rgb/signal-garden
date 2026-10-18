ALTER TABLE "ai_content" ADD COLUMN "hook" text;--> statement-breakpoint
ALTER TABLE "ai_content" ADD COLUMN "hook_type" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "primary_category" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "secondary_category" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "forks_24h" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "forks_7d" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "stars_24h" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "stars_7d" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "growth_measured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "is_rising" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "first_tracked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "preview_image_url" text;--> statement-breakpoint
CREATE INDEX "project_primary_idx" ON "project" USING btree ("primary_category");--> statement-breakpoint
CREATE INDEX "project_growth_idx" ON "project" USING btree ("growth_measured_at");