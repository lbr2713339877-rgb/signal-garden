-- Signal Garden V1 — Row Level Security
-- Run in Supabase SQL editor after the Drizzle migrations have created the tables.
--
-- Newsletter and ops tables are not listed here. RLS with no policies for
-- newsletter_subscriber, newsletter_send, newsletter_rate_event,
-- indexnow_submission, api_request_daily, and project_slug_alias is
-- drizzle/0019_enable_rls_newsletter_and_ops_tables.sql.
-- Production already applied that SQL as Supabase migration
-- enable_rls_newsletter_and_ops_tables. Re-running ENABLE ROW LEVEL SECURITY
-- is safe; do not add policies for those tables in this file.

alter table profiles enable row level security;
alter table user_preferences enable row level security;
alter table saved_projects enable row level security;
alter table follows enable row level security;
alter table subscriptions enable row level security;

-- profiles: a user can read and update only their own row
create policy "profiles_select_own" on profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = user_id);

-- user_preferences
create policy "prefs_select_own" on user_preferences for select using (auth.uid() = user_id);
create policy "prefs_insert_own" on user_preferences for insert with check (auth.uid() = user_id);
create policy "prefs_delete_own" on user_preferences for delete using (auth.uid() = user_id);

-- saved_projects
create policy "saved_select_own" on saved_projects for select using (auth.uid() = user_id);
create policy "saved_insert_own" on saved_projects for insert with check (auth.uid() = user_id);
create policy "saved_delete_own" on saved_projects for delete using (auth.uid() = user_id);

-- follows
create policy "follows_select_own" on follows for select using (auth.uid() = user_id);
create policy "follows_insert_own" on follows for insert with check (auth.uid() = user_id);
create policy "follows_delete_own" on follows for delete using (auth.uid() = user_id);

-- subscriptions: read own only. Writes happen from the server (service role).
create policy "subscriptions_select_own" on subscriptions for select using (auth.uid() = user_id);
