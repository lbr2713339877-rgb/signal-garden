ALTER TABLE "project" ADD COLUMN "github_node_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "default_branch" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "homepage_url" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "topics" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "raw_data_hash" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "discovery_queries" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "code_hit_paths" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "meta_refreshed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "head_sha" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "parsed_head_sha" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "parsed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "ai_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "commits_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "readme_text" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "readme_hash" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "skill_type" "skill_type" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "skill_confidence" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "is_verified_skill" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "has_skill_md" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "skill_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "supported_agents" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "install_commands" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "risk_flags" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "doc_signals" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "parse_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "category_source" varchar(8);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "junk_reason" text;--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "skill" ADD COLUMN "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "project_meta_idx" ON "project" USING btree ("meta_refreshed_at");--> statement-breakpoint
CREATE INDEX "project_readme_hash_idx" ON "project" USING btree ("readme_hash");