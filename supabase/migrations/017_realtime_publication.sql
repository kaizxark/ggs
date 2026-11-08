-- ============================================================================
-- 017 — Realtime publication
--
-- ## Why this migration exists
--
-- Postgres Changes only delivers events for tables that are members of the
-- `supabase_realtime` publication. The client now subscribes per view, so any
-- ERP table a screen reads must be in that publication — otherwise the
-- subscription joins successfully and then simply never fires.
--
-- `supabase/schema.sql` has a similar loop, but it lists tables that do not all
-- exist in this database and omits several that the ERP actually reads
-- (`enrollments`, `classrooms`, ` examinations`, `student_guardians`, ...).
-- This file is the source of truth for what streams.
--
-- ## What Realtime guarantees
--
-- Postgres Changes authorises every INSERT and UPDATE event against the
-- subscriber's JWT with the same RLS policies that protect reads here, so each
-- session only receives the rows it could have read itself.
--
-- Supabase does **not** apply RLS to DELETE events (there is no row left to
-- check), so a DELETE payload carries only the primary key of the removed row.
-- The client treats DELETE purely as "reload this view" and never renders the
-- payload, so an unauthorized delete notification can leak nothing.
--
-- ## How it runs
--
-- Safe to run more than once: the loop skips tables that do not exist, and
-- checks publication membership before each `add table` (the statement itself
-- raises `duplicate_object` for a table that is already a member).
-- ============================================================================

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    -- Roster and identity ------------------------------------------------
    'students',
    'enrollments',
    'classrooms',
    'staff',
    'profiles',
    'academic_years',
    'organisations',
    'invitations',

    -- Attendance ----------------------------------------------------------
    'attendance',
    'attendance_corrections',

    -- Academics -----------------------------------------------------------
    'examinations',
    'exam_results',
    'subjects',
    'subject_teachers',
    'assignments',
    'grade_outcomes',

    -- Money ---------------------------------------------------------------
    'fee_categories',
    'fee_accounts',
    'fee_structure',
    'fee_installments',
    'invoices',
    'payments',

    -- Records and communications -----------------------------------------
    'announcements',
    'messages',
    'notifications',
    'student_guardians',
    'guardians',
    'student_documents',
    'student_health_records',
    'student_health_incidents',
    'student_observations',

    -- Library and transport ----------------------------------------------
    'library_books',
    'library_loans',
    'transport_routes',
    'vehicles',

    -- Timetables, schedules and misc --------------------------------------
    -- Class timetables are stored in `settings` rows (`timetable:<uuid>`),
    -- so `settings` being here is what makes timetable edits stream.
    'settings',
    'schedule',
    'activity_log',
    'activities',
    'activity_participations',
    'report_exports',

    -- Account backends (sign-in lists read these through /api) -------------
    'student_credentials',
    'staff_credentials'
  ] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = tbl
    ) then
      raise notice '017: skipping missing table public.%', tbl;
      continue;
    end if;

    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      continue;
    end if;

    execute format(
      'alter publication supabase_realtime add table public.%I',
      tbl
    );
    raise notice '017: added public.% to supabase_realtime', tbl;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Replica identity
--
-- UPDATE and DELETE payloads only carry the columns in a table's replica
-- identity (by default the primary key). That is all the client needs — it
-- re-reads whatever changed — and `full` would attach every column to every
-- event on busy tables, so the default is left in place.
--
-- The ERP history view, `activity_log`, does carry a human-readable summary of
-- every change in its own columns, so nothing else needs the old values.
-- ---------------------------------------------------------------------------
