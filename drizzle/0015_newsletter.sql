-- Daily digest list. Email is stored lowercase: this Postgres build (PGlite)
-- does not ship the citext extension, so a check constraint stands in for it.
-- `subscriptions` and `user_subscription` stay untouched; those are plans and filters.
CREATE TYPE "public"."newsletter_status" AS ENUM('pending', 'active', 'unsubscribed', 'bounced', 'complained');--> statement-breakpoint
CREATE TYPE "public"."newsletter_send_status" AS ENUM('queued', 'sent', 'failed', 'bounced');--> statement-breakpoint
CREATE TABLE "newsletter_subscriber" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text,
  "email_hash" text NOT NULL,
  "locale" text DEFAULT 'zh' NOT NULL,
  "status" "newsletter_status" DEFAULT 'pending' NOT NULL,
  "confirm_token_hash" text,
  "confirm_expires_at" timestamp with time zone,
  "unsub_token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "unsubscribed_at" timestamp with time zone,
  "last_sent_at" timestamp with time zone,
  "purge_email_at" timestamp with time zone,
  "source" text,
  "consent_ip_hash" text,
  "consent_ua" text,
  CONSTRAINT "newsletter_subscriber_email_lower" CHECK ("email" IS NULL OR "email" = lower("email")),
  CONSTRAINT "newsletter_subscriber_locale" CHECK ("locale" IN ('zh', 'en'))
);--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscriber_email_uniq" ON "newsletter_subscriber" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscriber_email_hash_uniq" ON "newsletter_subscriber" ("email_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscriber_unsub_uniq" ON "newsletter_subscriber" ("unsub_token_hash");--> statement-breakpoint
CREATE INDEX "newsletter_subscriber_confirm_idx" ON "newsletter_subscriber" ("confirm_token_hash");--> statement-breakpoint
CREATE INDEX "newsletter_subscriber_status_idx" ON "newsletter_subscriber" ("status");--> statement-breakpoint
CREATE TABLE "newsletter_send" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_date" date NOT NULL,
  "subscriber_id" uuid NOT NULL,
  "resend_message_id" text,
  "status" "newsletter_send_status" DEFAULT 'queued' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "newsletter_send_edition_subscriber_uniq" UNIQUE("edition_date", "subscriber_id")
);--> statement-breakpoint
ALTER TABLE "newsletter_send" ADD CONSTRAINT "newsletter_send_subscriber_id_newsletter_subscriber_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."newsletter_subscriber"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletter_send_message_idx" ON "newsletter_send" ("resend_message_id");--> statement-breakpoint
CREATE TABLE "newsletter_rate_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bucket" text NOT NULL,
  "key_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "newsletter_rate_event_idx" ON "newsletter_rate_event" ("bucket", "key_hash", "created_at");
