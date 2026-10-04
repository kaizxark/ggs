-- ============================================================================
-- Global Kids School ERP — roles, invitations and student portal logins
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New).
-- It is idempotent: re-running it is safe.
--
-- Why this exists
--   * `app_role` had no `super_admin`, so nobody could be the owner of the
--     school. It also had no `student`, even though students log in.
--   * There was nowhere to record a pending invitation or the credentials
--     handed to a family for a student portal login.
-- ============================================================================

-- 1. Extend the role enum -----------------------------------------------------
-- Postgres has no "add value if not exists", so guard each with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin') THEN
    ALTER TYPE app_role ADD VALUE 'super_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e
                 JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'app_role' AND e.enumlabel = 'student') THEN
    ALTER TYPE app_role ADD VALUE 'student';
  END IF;
END
$$;

-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
-- older Postgres. If the block above errors with "ALTER TYPE ... cannot run
-- inside a transaction block", run the two ALTER TYPE statements on their own
-- and then re-run this file.

-- 2. Promotion of the school owner -------------------------------------------
-- Matched on the immutable user id, NOT on the email. The Settings screen
-- rewrites an account's email when its username changes, so an email-matched
-- UPDATE silently matches zero rows the moment the owner renames himself — and
-- a migration that reports success while promoting nobody is worse than one
-- that fails. The id is the same anchor shared/super-admin.ts uses, so the
-- database and the application agree on who the owner is.
--
-- 60ff6003-c0a4-438f-85df-2048b0e7b6c8 — kaizxark@gmail.com, "Ehtesham".
UPDATE profiles
   SET role = 'super_admin'
 WHERE id = '60ff6003-c0a4-438f-85df-2048b0e7b6c8'
   AND role <> 'super_admin';

-- 3. Invitations ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  full_name       text,
  username        text,
  temp_password   text,
  role            app_role    NOT NULL DEFAULT 'staff',
  status          text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS invitations_org_idx
  ON invitations (organisation_id, status);

-- 4. Student portal credentials -----------------------------------------------
CREATE TABLE IF NOT EXISTS student_credentials (
  student_id      uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  organisation_id uuid        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  username        text        NOT NULL,
  password        text        NOT NULL,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  issued_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  revoked_at      timestamptz
);

-- 5. Link a profile back to the student it belongs to -------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_id uuid
  REFERENCES students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS profiles_student_idx
  ON profiles (student_id);

-- 6. Backfill the current admin's role so the UI resolves immediately --------
-- (already done in step 2; kept here so a partial run still converges)

-- 7. Row level security -------------------------------------------------------
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_credentials  ENABLE ROW LEVEL SECURITY;

-- Admins and super admins manage their own school's invitations.
DROP POLICY IF EXISTS invitations_admin_all ON invitations;
CREATE POLICY invitations_admin_all ON invitations
  FOR ALL
  USING (
    organisation_id = (
      SELECT organisation_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    organisation_id = (
      SELECT organisation_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- A student may read their own credentials; nobody else needs to.
DROP POLICY IF EXISTS student_credentials_own ON student_credentials;
CREATE POLICY student_credentials_own ON student_credentials
  FOR SELECT
  USING (
    student_id IN (SELECT student_id FROM profiles WHERE id = auth.uid())
  );