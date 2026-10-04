-- ============================================================================
-- profiles.username
--
-- Why this file exists
--
-- The Settings screen has always let a person choose a username and has always
-- saved it to `profiles.username`. That column was never created in the live
-- project, so every save failed:
--
--   Could not find the 'username' column of 'profiles' in the schema cache
--   (PostgREST PGRST204)
--
-- The failure was total rather than partial. `saveProfile` writes the display
-- name and then the username; the second write threw, so the toast read "Could
-- not save your profile" and the user was left thinking nothing had been saved.
--
-- This is not the same problem as `public.settings` (migration 002). There the
-- whole table was missing. Here the table exists and row level security already
-- allows a signed-in person to update their own row — only the column was
-- absent.
--
-- Safe to run more than once: every statement is guarded.
-- ============================================================================

begin;

-- 1. The column ----------------------------------------------------------------
-- Nullable while the backfill below runs, then tightened.
alter table public.profiles add column if not exists username text;

-- 2. Backfill ------------------------------------------------------------------
-- A username is the local part of the sign-in address, which is exactly what
-- `shared/username-lookup.ts` already resolves. Seeding from the email therefore
-- reproduces the behaviour people have today rather than inventing new logins.
update public.profiles p
   set username = lower(split_part(p.email, '@', 1))
 where p.username is null
   and p.email is not null
   and position('@' in p.email) > 1;

-- 3. Deliberately NOT unique --------------------------------------------------
-- Measured on the live data before this file was written:
--
--   total=91  no_email=0  unusable=0
--   duplicate local parts: basanagouda.reddy x2
--     basanagouda.reddy@gmail.com
--     basanagouda.reddy@outlook.com
--
-- One genuine collision, and it is a real person with two mailboxes — the case
-- `api/login.ts` already documents and handles by trying every candidate address
-- until the password matches. A unique index here would refuse the migration
-- outright, and forcing the pair apart would rename one of them without anyone
-- asking. So uniqueness is enforced where a change actually happens: the
-- Settings screen checks the name is free before saving, which is also the only
-- place a collision can be introduced.
--
-- A plain index still earns its place — every sign-in resolves a username by
-- scanning this column.
create index if not exists profiles_username_idx
  on public.profiles (lower(username));

-- 4. Tighten -------------------------------------------------------------------
-- Only once the backfill has covered every row. Any row still NULL here had no
-- usable email, so it is left nullable rather than failing the whole migration.
do $$
begin
  if not exists (select 1 from public.profiles where username is null) then
    alter table public.profiles alter column username set not null;
  end if;
end
$$;

commit;

-- ============================================================================
-- After running this, everyone can change their own username from
-- Settings -> Profile, and the new name works as a login.
--
-- Sign-in resolves a username through this column first and falls back to the
-- email local part, so anyone who has not chosen a name keeps working exactly as
-- before. Password recovery is untouched: it still goes to the email address,
-- which this change never modifies.
--
-- To confirm:
--   select username, email, role from public.profiles order by role, username;
-- ============================================================================
