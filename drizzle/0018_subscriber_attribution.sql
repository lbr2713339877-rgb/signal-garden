-- Signup attribution on newsletter subscribers. Nullable additions only:
-- existing rows stay valid, and no current column is altered or dropped.
ALTER TABLE "newsletter_subscriber" ADD COLUMN IF NOT EXISTS "utm_source" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN IF NOT EXISTS "utm_medium" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN IF NOT EXISTS "utm_campaign" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN IF NOT EXISTS "utm_content" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscriber" ADD COLUMN IF NOT EXISTS "referrer" text;
