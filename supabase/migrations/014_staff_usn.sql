-- ============================================================================
-- 014 — Every member of staff gets a USN
--
-- A pupil already has one identifier the school can say out loud: the USN.
-- Staff did not. The staff record carried an `employee_code` in a different
-- shape (`EMP-YYYY-NNN`) that the application generated, displayed in some
-- places and not others, and never treated as the record's identity.
--
-- This migration gives staff a USN of their own, in the same spirit as the
-- pupil number but with a prefix that cannot be mistaken for one: `STF` and
-- four digits, for example STF1001. The prefix is deliberately not `GGS`, so a
-- member of staff's number can never collide with a pupil's even if the two
-- sequences grow independently.
--
-- `employee_code` is left in place. Existing rows still carry it, and dropping
-- a column that payroll or an export may still read is a separate decision.
-- The application stops reading and writing it; `usn` is the identifier from
-- here on.
-- ============================================================================

begin;

alter table public.staff add column if not exists usn text;

-- `employee_code` was NOT NULL. The application no longer writes it, so leaving
-- the constraint in place would make every new staff record fail at insert
-- time. The column stays for historical data; new rows simply have no value.
alter table public.staff alter column employee_code drop not null;

-- Backfill per school, so every tenant starts its own STF sequence, and in a
-- stable order (joining date, then name) so running this on a fresh copy of the
-- data assigns the same numbers.
with base as (
  select organisation_id,
         coalesce(
           max((regexp_replace(usn, '[^0-9]', '', 'g'))::int),
           1000
         ) as start
    from public.staff
   where usn ~* '^STF[0-9]+$'
   group by organisation_id
), missing as (
  select s.id,
         s.organisation_id,
         coalesce(b.start, 1000) + row_number() over (
           partition by s.organisation_id
           order by s.joined_on nulls last, lower(s.name), s.id
         ) as n
    from public.staff s
    left join base b on b.organisation_id = s.organisation_id
   where s.usn is null or btrim(s.usn) = ''
)
update public.staff s
   set usn = 'STF' || lpad(m.n::text, 4, '0')
  from missing m
 where s.id = m.id;

do $$
declare
  missing integer;
  duplicates integer;
begin
  select count(*) into missing
    from public.staff
   where usn is null or btrim(usn) = '';
  if missing > 0 then
    raise exception 'staff.usn backfill left % row(s) without a USN', missing;
  end if;

  select count(*) into duplicates
    from (
      select organisation_id, lower(usn)
        from public.staff
       group by 1, 2
      having count(*) > 1
    ) d;
  if duplicates > 0 then
    raise exception 'staff.usn backfill produced % duplicate USN(s)', duplicates;
  end if;
end $$;

alter table public.staff alter column usn set not null;

create unique index if not exists staff_organisation_usn_unique
  on public.staff (organisation_id, lower(usn));

comment on column public.staff.usn is
  'Unique staff number. The staff-facing identifier, printed and spoken like a pupil USN.';

comment on column public.staff.employee_code is
  'Deprecated: staff records are identified by usn. Kept for historical payroll data; the application no longer reads or writes it.';

commit;
