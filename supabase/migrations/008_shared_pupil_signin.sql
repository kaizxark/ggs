-- ============================================================================
-- Global Kids School ERP — the shared pupil sign-in name
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New).
-- It is idempotent: re-running it is safe.
--
-- Why the name is a setting and not a column on the pupil record
--
-- `student_credentials.username` is unique within the school, because two
-- people sharing a login name fails confusingly rather than loudly. A hundred
-- pupils cannot each hold a copy of one name in a column that refuses
-- duplicates, so the name is held once — here, in `public.settings`, which is
-- where the school keeps its own configuration — and the sign-in routes read
-- it when they need to work out what a typed name means.
--
-- The name that is actually typed is written to `profiles.username`, which is
-- not unique and is already what the sign-in route resolves. That is the
-- column a pupil's own chosen name goes into as well, so the route has one
-- place to look.
--
-- What this file does, in order
--
--   1. Seeds the school's shared sign-in name.
--   2. Puts that name on every pupil profile that has not claimed one.
--   3. Backfills `student_credentials.email`, so the row the school owner
--      reads says which address the account signs in with.
--
-- What this file cannot do
--
-- It cannot set a password. Supabase Auth holds those, and the admin API is
-- not reachable from SQL. The password a pupil signs in with is their date of
-- birth, and the one-off that writes it is `/api/portal-admin` with
-- `action=reset-pupil-passwords`, which the owner can run from the
-- credentials screen. It writes the auth password and the school's record of
-- it in the same pass, so the two cannot disagree.
-- ============================================================================

begin;

-- 1. The shared name ----------------------------------------------------------
--
-- `on conflict (key) do nothing` leaves a name that has already been changed
-- alone, so re-running this never undoes the owner's decision.
insert into public.settings (id, key, value)
values ('set-portal_shared_username', 'portal_shared_username',
        '"kaizxark@gmail.com"'::jsonb)
on conflict (key) do nothing;

-- 2. The name on every pupil profile ------------------------------------------
--
-- A pupil who has claimed a name of their own keeps it. `username_chosen_at`
-- is what says they have: it is set the moment somebody chooses a name for
-- themselves, and it is never set by anything else.
--
-- The application does the same thing through
-- `applySharedUsernameToPupils`, so the two agree on who is who.
update public.profiles p
   set username = 'kaizxark@gmail.com'
  from public.students s
 where s.id = p.student_id
   and p.username is distinct from 'kaizxark@gmail.com'
   and not exists (
         select 1
           from public.student_credentials sc
          where sc.student_id = p.student_id
            and sc.username_chosen_at is not null
       );

-- 3. The address on the school's record of each pupil's account ---------------
--
-- `student_credentials.email` is the address the account signs in with, and it
-- was null on every row: the column was added by migration 007 and nothing
-- wrote it. The owner reads this row to tell somebody their login, and a row
-- with no address in it is a row that cannot answer the question.
--
-- The username is brought into line with it for the same reason. That column
-- is unique within the school, so a pupil whose address is already taken by
-- another row is left alone rather than being pushed into a collision.
update public.student_credentials sc
   set email = s.email,
       username = s.email
  from public.students s
 where s.id = sc.student_id
   and s.email is not null
   and s.email <> ''
   and sc.email is distinct from s.email
   -- Only where this address is this pupil's alone.
   and (select count(*)
          from public.students other
         where other.organisation_id = s.organisation_id
           and lower(other.email) = lower(s.email)) = 1;

commit;

-- After running this:
--
--   * every pupil signs in with kaizxark@gmail.com and their date of birth;
--   * the credentials screen shows that name in the "Username" column;
--   * the credentials screen shows each pupil's address again.
--
-- To confirm the name is set:
--
--   select key, value from public.settings where key = 'portal_shared_username';
--
-- And to confirm the pupils are on it:
--
--   select username, count(*) from public.profiles
--    where student_id is not null group by username;
--
-- Then run "Reset pupil passwords to their date of birth" on the credentials
-- screen, so the passwords agree with the dates on the records.
-- ============================================================================
