ALTER TABLE "profiles" ADD COLUMN "welcome_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "marketing_opt_in" boolean DEFAULT true NOT NULL;