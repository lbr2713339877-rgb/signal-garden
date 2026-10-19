CREATE TABLE "api_request_daily" (
  "day" date NOT NULL,
  "path" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "api_request_daily_pkey" PRIMARY KEY("day","path")
);--> statement-breakpoint
CREATE TABLE "indexnow_submission" (
  "day" date NOT NULL,
  "payload_hash" text NOT NULL,
  "status" integer NOT NULL,
  "url_count" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "indexnow_submission_pkey" PRIMARY KEY("day","payload_hash")
);
