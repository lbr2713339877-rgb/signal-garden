-- Enable RLS on newsletter and ops tables. No policies: anon and authenticated
-- are denied. service_role and the DATABASE_URL table owner bypass RLS.
--
-- Production already applied this SQL as Supabase migration
-- `enable_rls_newsletter_and_ops_tables` (apply_migration). Supabase records
-- that name in its own migration history, not in `_sg_migrations`.
-- `pnpm db:migrate` (src/db/migrate.ts) records the Drizzle tag
-- `0019_enable_rls_newsletter_and_ops_tables` in `_sg_migrations`, so the first
-- migrate against production runs these statements again and then inserts the
-- tag. Re-running ENABLE ROW LEVEL SECURITY is idempotent and adds no policies.
-- Do not apply a second copy under another name.
ALTER TABLE public.newsletter_subscriber ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.newsletter_send ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.newsletter_rate_event ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.indexnow_submission ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.api_request_daily ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.project_slug_alias ENABLE ROW LEVEL SECURITY;
