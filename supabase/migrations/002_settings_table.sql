-- ============================================================================
-- public.settings
--
-- Why this file exists
--
-- `supabase/schema.sql` has always declared this table, but it was never
-- created in the live project. Every other table in the schema is present, so
-- the schema was applied before this definition was appended to the file.
--
-- That left two features quietly broken rather than loudly failing:
--
--   1. The shared AI configuration (/api/ai-settings) had nowhere to write.
--      Saving returned "The configuration could not be saved. Check that this
--      server can reach the database." — which sent the reader after the wrong
--      problem entirely, because the database was reachable the whole time.
--   2. The school settings screen has been rendering its mock fallback, since
--      `useSettings()` reads this table and falls back when it cannot.
--
-- Safe to run more than once: every statement is guarded.
-- ============================================================================

begin;

create table if not exists public.settings (
  id    text primary key,
  key   text not null unique,
  value jsonb not null
);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Matches the policy the rest of the schema applies to its tables: any signed-in
-- user may read and write. The AI credential is safe here because it is stored
-- sealed (AES-GCM) and only the ciphertext is ever written — see
-- `shared/ai-config.ts`. A super admin can replace the key but cannot read it
-- back, so this table never hands a plaintext credential to a client.
-- ---------------------------------------------------------------------------

alter table public.settings enable row level security;

drop policy if exists "authenticated read" on public.settings;
create policy "authenticated read" on public.settings
  for select to authenticated using (true);

drop policy if exists "authenticated write" on public.settings;
create policy "authenticated write" on public.settings
  for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.settings to authenticated;

-- ---------------------------------------------------------------------------
-- Seed rows
--
-- Without these the school settings screen shows its hard-coded fallback until
-- someone edits a field. `on conflict (key) do nothing` leaves anything already
-- present untouched, so re-running this never overwrites a real setting.
-- ---------------------------------------------------------------------------

insert into public.settings (id, key, value) values
  ('set-1',  'school_name',           '"Global Kids School"'::jsonb),
  ('set-2',  'campus',                '"Tumakuru"'::jsonb),
  ('set-3',  'address',               '"2nd Cross, Tumakuru, Karnataka"'::jsonb),
  ('set-4',  'phone',                 '"+91 98765 43210"'::jsonb),
  ('set-5',  'academic_year',         '"2026–27"'::jsonb),
  ('set-6',  'current_term',          '"Term 1"'::jsonb),
  ('set-7',  'grade_scale',           '"Percentage (0–100)"'::jsonb),
  ('set-8',  'attendance_threshold',  '"90%"'::jsonb),
  ('set-9',  'notif_attendance',      'true'::jsonb),
  ('set-10', 'notif_fees',            'true'::jsonb),
  ('set-11', 'notif_messages',        'true'::jsonb),
  ('set-12', 'notif_exams',           'false'::jsonb),
  ('set-13', 'notif_digest',          'true'::jsonb)
on conflict (key) do nothing;

commit;

-- ============================================================================
-- After running this, go back to Settings -> AI assistant and press
-- "Save for everyone" again. The key you pasted was never stored, so it has to
-- be entered once more.
--
-- To confirm the table exists:
--   select key from public.settings order by key;
-- ============================================================================
