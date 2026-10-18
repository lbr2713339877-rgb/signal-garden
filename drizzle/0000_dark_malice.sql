CREATE TYPE "public"."category" AS ENUM('skill', 'agent', 'devtool', 'design', 'browser', 'media', 'data', 'productivity', 'security', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('one_click', 'simple_config', 'needs_api_key', 'needs_local', 'needs_dev', 'expert');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('dead_link', 'wrong_category', 'inaccurate_desc', 'security_risk', 'unmaintained');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('pending', 'reviewed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('running', 'ok', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."link_status" AS ENUM('ok', 'dead', 'redirect', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."parse_state" AS ENUM('pending', 'parsed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_kind" AS ENUM('repo', 'product', 'story_derived');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('new', 'surging', 'steady', 'slowing', 'unstable', 'stale', 'archived', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."recommendation" AS ENUM('try', 'watch', 'caution', 'avoid');--> statement-breakpoint
CREATE TYPE "public"."save_target" AS ENUM('project', 'skill');--> statement-breakpoint
CREATE TYPE "public"."security_level" AS ENUM('safe', 'review', 'risk', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."skill_type" AS ENUM('skill', 'mcp', 'agent', 'prompt_pack', 'workflow', 'library', 'framework', 'template', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('github', 'hackernews', 'producthunt', 'community');--> statement-breakpoint
CREATE TYPE "public"."subscription_kind" AS ENUM('category', 'keyword', 'platform');--> statement-breakpoint
CREATE TABLE "ai_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"locale" varchar(8) DEFAULT 'zh' NOT NULL,
	"one_liner" text,
	"problem" text,
	"target_users" text[] DEFAULT '{}' NOT NULL,
	"why_now" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"not_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"limits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"install_hint" text,
	"risk_note" text,
	"recommendation" "recommendation" DEFAULT 'watch' NOT NULL,
	"evidence" jsonb,
	"passed_guard" boolean DEFAULT false NOT NULL,
	"guard_failures" jsonb DEFAULT '[]'::jsonb,
	"model" text,
	"prompt_version" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by_human" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ai_content_uniq" UNIQUE("project_id","locale")
);
--> statement-breakpoint
CREATE TABLE "daily_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_date" date NOT NULL,
	"project_id" uuid NOT NULL,
	"skill_id" uuid,
	"rank" integer NOT NULL,
	"heat_score" real NOT NULL,
	"breakdown" jsonb NOT NULL,
	"reason" text,
	"window" varchar(8) DEFAULT '7d' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_signal_uniq" UNIQUE("signal_date","project_id")
);
--> statement-breakpoint
CREATE TABLE "data_source_health" (
	"source" text PRIMARY KEY NOT NULL,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"quota_remaining" integer,
	"latency_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_mention" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source" varchar(32) NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"author" text,
	"points" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"is_show_hn" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mention_uniq" UNIQUE("project_id","source","url")
);
--> statement-breakpoint
CREATE TABLE "job_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" "job_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"items_in" integer DEFAULT 0 NOT NULL,
	"items_out" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_project_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner" text,
	"full_name" text,
	"primary_url" text NOT NULL,
	"domain" text,
	"description" text,
	"project_kind" "project_kind" DEFAULT 'repo' NOT NULL,
	"fork_of" text,
	"mirror_of" text,
	"duplicate_of" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"link_status" "link_status" DEFAULT 'unknown' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"category" "category",
	"tags" text[] DEFAULT '{}' NOT NULL,
	"difficulty" "difficulty",
	"status" "project_status" DEFAULT 'new' NOT NULL,
	"license" text,
	"pricing" text,
	"requires_api_key" boolean DEFAULT false NOT NULL,
	"requires_local_runtime" boolean DEFAULT false NOT NULL,
	"requires_docker" boolean DEFAULT false NOT NULL,
	"security_level" "security_level" DEFAULT 'unknown' NOT NULL,
	"parse_state" "parse_state" DEFAULT 'pending' NOT NULL,
	"content_hash" text,
	"last_error" text,
	"heat_score_latest" real DEFAULT 0 NOT NULL,
	"heat_computed_at" timestamp with time zone,
	"quality_grade" varchar(4),
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"upstream_created_at" timestamp with time zone,
	"upstream_pushed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_canonical_uniq" UNIQUE("canonical_project_id"),
	CONSTRAINT "project_slug_uniq" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "repo_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"open_issues" integer DEFAULT 0 NOT NULL,
	"watchers" integer DEFAULT 0 NOT NULL,
	"commits_7d" integer DEFAULT 0 NOT NULL,
	"releases_30d" integer DEFAULT 0 NOT NULL,
	"contributors" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"skill_confidence" real DEFAULT 0 NOT NULL,
	"skill_type" "skill_type" DEFAULT 'unknown' NOT NULL,
	"is_verified_skill" boolean DEFAULT false NOT NULL,
	"has_skill_md" boolean DEFAULT false NOT NULL,
	"has_installation" boolean DEFAULT false NOT NULL,
	"supported_agents" text[] DEFAULT '{}' NOT NULL,
	"frontmatter" jsonb,
	"source_path" text,
	"body_excerpt" text,
	"install_method" text,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_project_slug_uniq" UNIQUE("project_id","slug")
);
--> statement-breakpoint
CREATE TABLE "source_signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"raw_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"rejected_reason" text,
	CONSTRAINT "source_signal_uniq" UNIQUE("source","source_id","raw_hash")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"locale" varchar(8) DEFAULT 'zh' NOT NULL,
	"digest_enabled" boolean DEFAULT false NOT NULL,
	"digest_hour" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_uniq" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"project_id" uuid NOT NULL,
	"kind" "feedback_kind" NOT NULL,
	"note" text,
	"status" "feedback_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "save_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_save_uniq" UNIQUE("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "subscription_kind" NOT NULL,
	"value" text NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sub_uniq" UNIQUE("user_id","kind","value")
);
--> statement-breakpoint
ALTER TABLE "ai_content" ADD CONSTRAINT "ai_content_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_signal" ADD CONSTRAINT "daily_signal_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_signal" ADD CONSTRAINT "daily_signal_skill_id_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skill"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_mention" ADD CONSTRAINT "external_mention_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_snapshot" ADD CONSTRAINT "repo_snapshot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_save" ADD CONSTRAINT "user_save_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscription" ADD CONSTRAINT "user_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_content_reco_idx" ON "ai_content" USING btree ("recommendation");--> statement-breakpoint
CREATE INDEX "daily_signal_rank_idx" ON "daily_signal" USING btree ("signal_date","rank");--> statement-breakpoint
CREATE INDEX "daily_signal_published_idx" ON "daily_signal" USING btree ("is_published","signal_date");--> statement-breakpoint
CREATE INDEX "mention_published_idx" ON "external_mention" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "job_run_job_idx" ON "job_run" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "project_rank_idx" ON "project" USING btree ("category","heat_score_latest");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_parse_idx" ON "project" USING btree ("parse_state");--> statement-breakpoint
CREATE INDEX "project_updated_idx" ON "project" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "snapshot_project_time_idx" ON "repo_snapshot" USING btree ("project_id","captured_at");--> statement-breakpoint
CREATE INDEX "skill_type_idx" ON "skill" USING btree ("skill_type");--> statement-breakpoint
CREATE INDEX "skill_confidence_idx" ON "skill" USING btree ("skill_confidence");--> statement-breakpoint
CREATE INDEX "source_signal_unprocessed_idx" ON "source_signal" USING btree ("processed_at","fetched_at");--> statement-breakpoint
CREATE INDEX "source_signal_source_idx" ON "source_signal" USING btree ("source","fetched_at");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "user_feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "user_save_user_idx" ON "user_save" USING btree ("user_id","created_at");