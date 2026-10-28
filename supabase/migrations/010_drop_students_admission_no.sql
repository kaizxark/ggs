-- ============================================================================
-- 010 — Remove the old admission number from the student record
--
-- The USN now lives on `students` and is the identifier the app uses. Keeping
-- `admission_no` would leave two identities for the same pupil and a second
-- unique constraint that no longer means anything.
--
-- Deploy 009 and the application change first. This migration is intentionally
-- separate so there is no window where the app reads a column that has already
-- been dropped.
-- ============================================================================

begin;

alter table public.students drop column if exists admission_no;

commit;
