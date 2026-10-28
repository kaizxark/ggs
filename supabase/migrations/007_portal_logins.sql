-- ============================================================================
-- Global Kids School ERP — portal logins for staff and students
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New).
-- It is idempotent: re-running it is safe.
--
-- Why this exists
--
-- Until now only `student_credentials` existed, it was written by hand from a
-- button, and it was never provisioned from a student record. Nothing at all
-- existed for staff.
--
-- Sign-in now runs on an emailed one-time code. A person types their email
-- address, receives a code, proves the mailbox is theirs, and only then picks
-- a username and password of their own. That means:
--
--   * every student and staff row needs a usable email address, because the
--     address is the thing they prove they own;
--   * the row that holds their username and password has to be able to say
--     "this person has not chosen one yet", which is what `must_set_password`
--     is for;
--   * the code has to be stored somewhere the browser cannot read, so the OTP
--     table has policies that permit no reads at all.
--
-- The super admin can see every account's username and password. That is a
-- deliberate reversal of the earlier `PUBLIC_ACCOUNT_FIELDS` rule, which named
-- no credential at all. The policies below are the only place that is allowed
-- to change, so an ordinary admin, teacher or student cannot widen it.
-- ============================================================================

-- 1. Roles ---------------------------------------------------------------------
-- `accountant` is referenced throughout the application (api/invite.ts,
-- shared/student-access.ts, shared/ai-access.ts) but no migration ever added it
-- to the enum. On a database that predates it, every write of that role fails
-- with 23503 and the failure looks like a permissions problem rather than a
-- missing enum member. Adding it here is a no-op where it already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'accountant') THEN
    ALTER TYPE app_role ADD VALUE 'accountant';
  END IF;
END
$$;

-- 2. The super admin's immutable id -------------------------------------------
-- Anchored on the user id for the same reason migration 001 anchored on it, and
-- for the same reason shared/super-admin.ts does: the Settings screen rewrites
-- an account's email when its username changes, so anything matched on an
-- address quietly stops matching the moment somebody renames themselves.
CREATE OR REPLACE FUNCTION public.is_school_owner(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_id = '60ff6003-c0a4-438f-85df-2048b0e7b6c8'::uuid;
$$;

-- 3. The tables this migration builds on -----------------------------------------
-- Both created only if absent, and both matching migration 001's definitions.
--
-- This looks redundant and is not. The ALTERs and policies below operate on
-- these two tables and on profiles.student_id, all three of which 001 creates.
-- If 001 has not been applied to this database, those statements fail on a table
-- that does not exist, and a half-applied 007 leaves the login routes returning
-- errors with no indication of which migration was actually missing. Writing the
-- definitions here means this one file is enough, on any of the three possible
-- starting states.
CREATE TABLE IF NOT EXISTS student_credentials (
  student_id      uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  organisation_id uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  username        text        NOT NULL,
  password        text        NOT NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  issued_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at      timestamptz
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_id uuid
  REFERENCES students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS profiles_student_idx ON profiles (student_id);

-- 4. Staff portal credentials --------------------------------------------------
-- The twin of student_credentials. Keyed on the staff row rather than the auth
-- user, for the same reason the student one is: the staff row survives a
-- re-invite, and the auth user id is derivable from it through
-- staff.profile_id, so storing it here too would only create a second place
-- for it to go stale.
-- ----------------------------------------------------------------------------
-- `profiles.username` has to be nullable.
--
-- The `handle_new_user` trigger fires on signup and writes a profile row. It
-- left `username` null, but the column was declared NOT NULL, so the insert
-- failed and *creating any auth user raised an exception*. Every pupil and staff
-- login therefore could not be provisioned. The column is null until somebody
-- sets a username, which is exactly the state the trigger produces.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ALTER COLUMN username DROP NOT NULL;

CREATE TABLE IF NOT EXISTS staff_credentials (
  staff_id          uuid PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  organisation_id   uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  username          text        NOT NULL,
  password          text        NOT NULL,
  email             text        NOT NULL,
  must_set_password boolean     NOT NULL DEFAULT true,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  issued_by         uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at        timestamptz,
  username_chosen_at timestamptz,
  last_rotated_at   timestamptz
);

CREATE INDEX IF NOT EXISTS staff_credentials_org_idx
  ON staff_credentials (organisation_id);

-- 5. Bring student_credentials up to the same shape -----------------------------
-- ADD COLUMN IF NOT EXISTS throughout, so this runs against a database where
-- 001 has already been applied and one where it has not.
--
-- The default is false, not true. Rows that already exist were reached by a
-- username the person chose or was given, so they are already complete and
-- must not be pushed through a first-sign-in setup they never needed. The
-- provisioning code sets the flag explicitly to true on the rows it creates.
ALTER TABLE student_credentials
  ADD COLUMN IF NOT EXISTS email              text,
  ADD COLUMN IF NOT EXISTS must_set_password  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS username_chosen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_rotated_at    timestamptz;

CREATE INDEX IF NOT EXISTS student_credentials_org_idx
  ON student_credentials (organisation_id);

-- 6. One-time codes ------------------------------------------------------------
-- No policies are created for this table at all, which is the point: with RLS on
-- and no policy, nothing short of the service key can read a row. A code that
-- the browser could read would be a code that any signed-in user could read,
-- which is the same as no code at all.
--
-- Only the hash of the code is stored. A leaked table read then yields nothing
-- usable inside the code's remaining lifetime, and the code is short-lived
-- regardless.
CREATE TABLE IF NOT EXISTS login_otp_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL,
  code_hash       text        NOT NULL,
  organisation_id uuid        REFERENCES organisations(id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL,
  attempts        int         NOT NULL DEFAULT 0,
  consumed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_otp_codes_email_idx
  ON login_otp_codes (lower(email), created_at DESC);

-- 7. Row level security -------------------------------------------------------
ALTER TABLE student_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_otp_codes     ENABLE ROW LEVEL SECURITY;

-- The student who owns the account may read their own row. Everything else in
-- this table — including the password — is reachable through the owner policy
-- below and through nothing else.
DROP POLICY IF EXISTS student_credentials_own ON student_credentials;
CREATE POLICY student_credentials_own ON student_credentials
  FOR SELECT
  USING (
    student_id IN (SELECT student_id FROM profiles WHERE id = auth.uid())
  );

-- The school owner reads every student's account. This is the one place the
-- password column becomes readable through the database at all.
DROP POLICY IF EXISTS student_credentials_owner_read ON student_credentials;
CREATE POLICY student_credentials_owner_read ON student_credentials
  FOR SELECT
  USING (public.is_school_owner(auth.uid()));

-- The mirror pair for staff.
DROP POLICY IF EXISTS staff_credentials_own ON staff_credentials;
CREATE POLICY staff_credentials_own ON staff_credentials
  FOR SELECT
  USING (
    staff_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS staff_credentials_owner_read ON staff_credentials;
CREATE POLICY staff_credentials_owner_read ON staff_credentials
  FOR SELECT
  USING (public.is_school_owner(auth.uid()));

-- login_otp_codes keeps every policy it ever had removed, so re-running this
-- file cannot leave a read path behind from an earlier attempt.
DROP POLICY IF EXISTS login_otp_codes_read ON login_otp_codes;
DROP POLICY IF EXISTS login_otp_codes_write ON login_otp_codes;

-- 8. Uniqueness ----------------------------------------------------------------
-- Two people must never end up sharing a login name inside one school: the
-- login route resolves a username to a list of candidate addresses and tries
-- each, so a duplicate does not fail closed, it fails confusingly — the right
-- password stops being the one that works.
--
-- NULL emails are left alone. A row that has not had the backfill run against
-- it yet should not collide with another un-backfilled row, and the column is
-- nullable on student_credentials precisely so the backfill can be incremental.
CREATE UNIQUE INDEX IF NOT EXISTS student_credentials_username_unique
  ON student_credentials (organisation_id, lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS student_credentials_email_unique
  ON student_credentials (organisation_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_credentials_username_unique
  ON staff_credentials (organisation_id, lower(username));

CREATE UNIQUE INDEX IF NOT EXISTS staff_credentials_email_unique
  ON staff_credentials (organisation_id, lower(email));

-- 9. Where the sign-in address comes from ---------------------------------------
-- No new column. The code is sent to `students.email` for a pupil and
-- `staff.email` for a member of staff, both of which already exist and are
-- already editable through the dashboard. A separate `portal_email` column
-- would have been one more place for an address to be set and then forgotten,
-- and would have left the dashboard writing an address that sign-in ignored.