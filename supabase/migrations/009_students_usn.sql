-- ============================================================================
-- 009 — Make the USN the student identifier
--
-- `students.admission_no` was the old human-facing identifier and the source
-- the USN was derived from. The USN now exists in its own right on the pupil
-- record, so the admission number is no longer a separate identity.
--
-- This migration only adds and backfills. Dropping `admission_no` is a second
-- step (010) so the application can be deployed against the new column before
-- the old one disappears.
-- ============================================================================

begin;

alter table public.students add column if not exists usn text;

-- The credential row already holds the USN that was assigned to this pupil.
update public.students s
   set usn = lower(btrim(c.username))
  from public.student_credentials c
 where c.student_id = s.id
   and (s.usn is null or btrim(s.usn) = '');

-- Defensive fallback for any record that predates credentials: compact the
-- admission number the same way the USN generator did. This should be a no-op
-- on the current data, but it keeps the migration safe on a fresh database.
update public.students
   set usn = lower(regexp_replace(admission_no, '[^a-zA-Z0-9]', '', 'g'))
 where (usn is null or btrim(usn) = '')
   and admission_no is not null;

do $$
declare
  missing integer;
  duplicates integer;
begin
  select count(*) into missing
    from public.students
   where usn is null or btrim(usn) = '';
  if missing > 0 then
    raise exception 'students.usn backfill left % row(s) without a USN', missing;
  end if;

  select count(*) into duplicates
    from (
      select organisation_id, lower(usn)
        from public.students
       group by 1, 2
      having count(*) > 1
    ) d;
  if duplicates > 0 then
    raise exception 'students.usn backfill produced % duplicate USN(s)', duplicates;
  end if;
end $$;

alter table public.students alter column usn set not null;

create unique index if not exists students_organisation_usn_unique
  on public.students (organisation_id, lower(usn));

comment on column public.students.usn is
  'Unique student number. The pupil-facing identifier and sign-in name.';

commit;
