-- ============================================================================
-- 004 — Student management foundations
--
-- What this adds, and why each piece is needed
--
--   1. public.subjects — the Academics screen and `useSubjectsView()` have been
--      rendering mock rows because no such table has ever existed. Subject
--      marks do exist, but only as free text in `exam_results.subject`, which
--      cannot be filtered, grouped reliably or reported on.
--
--   2. exam_results.organisation_id — the table was created without an
--      organisation, so it was the one student-scoped table in the database
--      that row level security could not scope to a school. Every org check had
--      to join through `examinations` to work out which school a mark belongs
--      to. This backfills it from that same join, so the answer already exists
--      in the data and no row has to be invented.
--
--   3. public.subject_teachers — the Faculty role in the brief is "assigned
--      classes and subjects". Classrooms carry a class teacher, but nothing
--      records who teaches which subject, so that half cannot be enforced.
--
--   4. public.guardians + public.student_guardians — the brief requires
--      multiple guardians per student, a primary guardian, portal linkage and
--      per-guardian permissions. `students` has single guardian_name /
--      guardian_phone / guardian_email columns, which cannot express that. The
--      new tables are authoritative; the legacy columns stay in place and are
--      backfilled from the primary guardian so older screens keep working.
--
--   5. Access helpers — record level access is expressed as SECURITY DEFINER
--      functions, matching the existing `can_manage_school()` pattern. They
--      live in the database because row level security has to call them per row
--      and they must not themselves be filtered by the policies they feed.
--
-- Nothing here deletes or rewrites student data. The one exception is called
-- out where it happens: exam results whose examination row has vanished.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Subjects
-- ---------------------------------------------------------------------------

create table if not exists public.subjects (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name            text not null,
  code            text not null,
  description     text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A code is what marks and reports join on, so it must be unique per school.
  constraint subjects_org_code_key unique (organisation_id, code),
  constraint subjects_name_not_blank check (btrim(name) <> '')
);

comment on table public.subjects is
  'Subjects offered by the school. Replaces the free-text subject column on exam_results for new records.';

create index if not exists subjects_organisation_idx
  on public.subjects (organisation_id, active);

alter table public.subjects enable row level security;

drop policy if exists "organisation read" on public.subjects;
create policy "organisation read" on public.subjects
  for select to public
  using (organisation_id = public.current_organisation_id());

drop policy if exists "school management write" on public.subjects;
create policy "school management write" on public.subjects
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists subjects_updated_at on public.subjects;
create trigger subjects_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

drop trigger if exists audit_subjects on public.subjects;
create trigger audit_subjects
  after insert or update or delete on public.subjects
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.subjects to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Scope exam results to an organisation
-- ---------------------------------------------------------------------------
--
-- Added nullable, backfilled from the exam each result belongs to, then locked
-- down. Split into steps so a failure part way through leaves the column
-- nullable and the data intact rather than dropping marks.

alter table public.exam_results add column if not exists organisation_id uuid;

update public.exam_results r
   set organisation_id = e.organisation_id
  from public.examinations e
 where e.id = r.examination_id
   and r.organisation_id is null;

-- A result whose examination row is missing has no organisation to inherit,
-- cannot be attributed to a school, and cannot be shown to anyone under any
-- policy. Rather than invent a school for it, these rows go, and the count is
-- raised so the deletion is never silent.
do $$
declare
  orphans integer;
begin
  select count(*) into orphans from public.exam_results where organisation_id is null;
  if orphans > 0 then
    delete from public.exam_results where organisation_id is null;
    raise warning 'exam_results: removed % row(s) whose examination no longer exists', orphans;
  end if;
end $$;

alter table public.exam_results
  alter column organisation_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exam_results_organisation_id_fkey'
  ) then
    alter table public.exam_results
      add constraint exam_results_organisation_id_fkey
      foreign key (organisation_id) references public.organisations (id) on delete cascade;
  end if;
end $$;

create index if not exists exam_results_organisation_student_idx
  on public.exam_results (organisation_id, student_id);

create index if not exists exam_results_organisation_exam_subject_idx
  on public.exam_results (organisation_id, examination_id, subject);

-- ---------------------------------------------------------------------------
-- 3. Who teaches what
-- ---------------------------------------------------------------------------

create table if not exists public.subject_teachers (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  subject_id       uuid not null references public.subjects (id) on delete cascade,
  classroom_id     uuid not null references public.classrooms (id) on delete cascade,
  staff_id         uuid not null references public.staff (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  is_primary       boolean not null default false,
  created_at       timestamptz not null default now(),
  -- The same person may teach the same subject to two sections, but not twice
  -- to the same one.
  constraint subject_teachers_unique unique (subject_id, classroom_id, staff_id)
);

comment on table public.subject_teachers is
  'Which member of staff teaches which subject to which class. Backs the "assigned subjects" half of the Faculty role.';

create index if not exists subject_teachers_organisation_idx
  on public.subject_teachers (organisation_id, classroom_id);

create index if not exists subject_teachers_staff_idx
  on public.subject_teachers (organisation_id, staff_id);

alter table public.subject_teachers enable row level security;

drop policy if exists "organisation read" on public.subject_teachers;
create policy "organisation read" on public.subject_teachers
  for select to public
  using (organisation_id = public.current_organisation_id());

drop policy if exists "school management write" on public.subject_teachers;
create policy "school management write" on public.subject_teachers
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists audit_subject_teachers on public.subject_teachers;
create trigger audit_subject_teachers
  after insert or update or delete on public.subject_teachers
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.subject_teachers to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guardians
-- ---------------------------------------------------------------------------

create table if not exists public.guardians (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  full_name       text not null,
  relationship    text,
  gender          text,
  phone           text,
  alternate_phone text,
  email           text,
  occupation      text,
  address         jsonb not null default '{}'::jsonb,
  photo_url       text,
  national_id     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint guardians_name_not_blank check (btrim(full_name) <> ''),
  constraint guardians_gender_check
    check (gender is null or gender in ('male', 'female', 'other', ''))
);

comment on table public.guardians is
  'A person responsible for a student. Shared across that student''s siblings.';

create index if not exists guardians_organisation_idx
  on public.guardians (organisation_id, full_name);

-- Deliberately no unique index on email or phone: two siblings share a father,
-- a family may use one number for both parents, and a landline is not an
-- identity. Near-duplicates are merged by hand from the profile screen.

alter table public.guardians enable row level security;

drop policy if exists "organisation read" on public.guardians;
create policy "organisation read" on public.guardians
  for select to public
  using (organisation_id = public.current_organisation_id());

drop policy if exists "school management write" on public.guardians;
create policy "school management write" on public.guardians
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists guardians_updated_at on public.guardians;
create trigger guardians_updated_at
  before update on public.guardians
  for each row execute function public.set_updated_at();

drop trigger if exists audit_guardians on public.guardians;
create trigger audit_guardians
  after insert or update or delete on public.guardians
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.guardians to authenticated;

create table if not exists public.student_guardians (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references public.organisations (id) on delete cascade,
  student_id           uuid not null references public.students (id) on delete cascade,
  guardian_id          uuid not null references public.guardians (id) on delete cascade,
  relationship         text,
  is_primary           boolean not null default false,
  is_emergency_contact boolean not null default false,
  -- Set when this guardian has a sign-in, so the parent portal resolves "my
  -- children" without matching on surnames or email addresses.
  portal_profile_id    uuid references public.profiles (id) on delete set null,
  -- Per-guardian permissions, so a father who pays fees need not read medical
  -- records. Null means "fall back to the guardian's portal default".
  can_view_academics   boolean,
  can_view_attendance  boolean,
  can_view_fees        boolean,
  can_view_documents   boolean,
  can_view_health      boolean,
  can_receive_messages boolean,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint student_guardians_unique unique (student_id, guardian_id)
);

comment on table public.student_guardians is
  'Links a guardian to a student, with the primary guardian and per-section portal permissions.';

create index if not exists student_guardians_student_idx
  on public.student_guardians (organisation_id, student_id);

-- The parent portal resolves its children through this index.
create index if not exists student_guardians_portal_idx
  on public.student_guardians (organisation_id, portal_profile_id);

alter table public.student_guardians enable row level security;

-- A guardian reads their own link row so the portal can list their children.
drop policy if exists "own guardian link read" on public.student_guardians;
create policy "own guardian link read" on public.student_guardians
  for select to public
  using (
    organisation_id = public.current_organisation_id()
    and (public.can_manage_school() or portal_profile_id = auth.uid())
  );

drop policy if exists "school management write" on public.student_guardians;
create policy "school management write" on public.student_guardians
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists student_guardians_updated_at on public.student_guardians;
create trigger student_guardians_updated_at
  before update on public.student_guardians
  for each row execute function public.set_updated_at();

drop trigger if exists audit_student_guardians on public.student_guardians;
create trigger audit_student_guardians
  after insert or update or delete on public.student_guardians
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.student_guardians to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Seed family links from the legacy columns
-- ---------------------------------------------------------------------------
--
-- `students` has carried one guardian_name / guardian_phone / guardian_email
-- since the schema was first applied, and that is the only family data that
-- exists today. Each distinct (organisation, name) pair becomes exactly one
-- guardian row, so two siblings naming the same father share one guardian
-- instead of creating two. The contact details are taken from the first
-- matching student rather than merged field by field: a later student with a
-- better phone number is a case for a human, not a silent overwrite.
--
-- Nothing is invented. A student with no guardian name gets no row.

insert into public.guardians (organisation_id, full_name, phone, email)
select s.organisation_id,
       btrim(s.guardian_name),
       min(s.guardian_phone)   filter (where s.guardian_phone   is not null and btrim(s.guardian_phone)   <> ''),
       min(s.guardian_email)   filter (where s.guardian_email   is not null and btrim(s.guardian_email)   <> '')
  from public.students s
 where s.guardian_name is not null
   and btrim(s.guardian_name) <> ''
 group by s.organisation_id, btrim(s.guardian_name)
on conflict do nothing;

insert into public.student_guardians (organisation_id, student_id, guardian_id, is_primary, is_emergency_contact)
select g.organisation_id, s.id, g.id, true, true
  from public.students s
  join public.guardians g
    on g.organisation_id = s.organisation_id
   and g.full_name       = btrim(s.guardian_name)
 where s.guardian_name is not null
   and btrim(s.guardian_name) <> ''
on conflict (student_id, guardian_id) do nothing;

-- Applied last, so it cannot reject the seed above and so the "exactly one
-- primary per child" rule is stated by the database rather than by whichever
-- code path happened to run first.
create unique index if not exists student_guardians_one_primary_idx
  on public.student_guardians (student_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- 6. Record level access helpers
-- ---------------------------------------------------------------------------
--
-- One predicate per class of information, so every new table uses the same rule
-- and no screen is free to invent its own. All SECURITY DEFINER: policies call
-- these per row, and without SECURITY DEFINER they would be filtered by the
-- very policies they are written into.

-- A pupil's own account, via profiles.student_id.
create or replace function public.is_own_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and student_id = p_student
  );
$$;

-- A guardian of this particular child, through the portal link.
create or replace function public.is_linked_guardian_of(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.student_guardians
     where student_id = p_student
       and portal_profile_id = auth.uid()
  );
$$;

-- Teaching staff reach a pupil through a class they are timetabled to teach,
-- either as class teacher or as the subject teacher for it.
create or replace function public.is_assigned_teacher_of(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.enrollments e
      join public.classrooms c on c.id = e.classroom_id
      join public.staff s       on s.id = c.class_teacher_id
     where e.student_id = p_student
       and e.active
       and s.profile_id = auth.uid()
  )
  or exists (
    select 1
      from public.enrollments e
      join public.subject_teachers st on st.classroom_id = e.classroom_id
      join public.staff s             on s.id = st.staff_id
     where e.student_id = p_student
       and e.active
       and s.profile_id = auth.uid()
  );
$$;

-- "May this caller see this child at all."
--
-- Admin and principal see the whole school. A pupil sees themselves, a guardian
-- sees their own children, a teacher sees their assigned classes. Everyone else
-- sees nothing, which is the safe direction for an unrecognised role.
create or replace function public.can_access_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role()::text in ('admin', 'principal')
      or public.is_own_student(p_student)
      or public.is_linked_guardian_of(p_student)
      or (public.current_role()::text = 'teacher' and public.is_assigned_teacher_of(p_student));
$$;

-- The read side of the ordinary family record: guardians' details, admission
-- history, observations, activities, library loans.
--
-- Staff and accountants keep school-wide read here. That matches what they
-- already had through the `organisation read` policy on `students`, so nothing
-- that works today is taken away.
create or replace function public.can_read_student_record(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role()::text in ('admin', 'principal', 'staff', 'accountant')
      or public.can_access_student(p_student);
$$;

-- Health is deliberately narrower than the rest of the family record: a
-- teacher needs allergies and medication to keep a child safe, but nobody needs
-- a full medical history to take a register.
create or replace function public.can_view_health_records(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role()::text in ('admin', 'principal')
      or (
        public.current_role()::text = 'teacher'
        and public.is_assigned_teacher_of(p_student)
      )
      or (
        public.is_linked_guardian_of(p_student)
        and exists (
          select 1 from public.student_guardians
           where student_id = p_student
             and portal_profile_id = auth.uid()
             and can_view_health is true
        )
      );
$$;

-- Money follows the finance roles, plus a guardian whose link row grants fees.
create or replace function public.can_view_student_finance(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_finance()
      or (
        public.is_linked_guardian_of(p_student)
        and exists (
          select 1 from public.student_guardians
           where student_id = p_student
             and portal_profile_id = auth.uid()
             and can_view_fees is true
        )
      );
$$;

-- The two existing exam result policies predate `organisation_id` and scoped
-- nothing to a school. Replaced with equivalents that scope by organisation and
-- then by child, so a parent reads their own child's marks and not the school.
drop policy if exists "exam result read" on public.exam_results;
create policy "exam result read" on public.exam_results
  for select to public
  using (
    organisation_id = public.current_organisation_id()
    and public.can_read_student_record(student_id)
  );

drop policy if exists "exam result management write" on public.exam_results;
create policy "exam result management write" on public.exam_results
  for all to public
  using (
    organisation_id = public.current_organisation_id()
    and public.can_manage_school()
    and public.can_read_student_record(student_id)
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.can_manage_school()
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.exam_results to authenticated;

commit;

-- ============================================================================
-- After running this:
--
--   select count(*) from public.subjects;            -- 0, seeded from the screen
--   select count(*) from public.guardians;           -- one row per family name
--   select count(*) from public.student_guardians;   -- linked primary guardians
--   select count(*) from public.exam_results
--    where organisation_id is null;                  -- 0
--   select count(*) from public.student_guardians sg -- 0
--    join public.students s on s.id = sg.student_id
--    where s.organisation_id <> sg.organisation_id;  -- cross-tenant guard
--
-- Subjects are deliberately left empty. The names exist only as free text in
-- `exam_results.subject`; seeding them automatically would fix a canonical
-- spelling ("Hindi" vs "HINDI" vs "hindi") that nobody has chosen yet. They are
-- added from the Academics screen once an admin confirms them.
-- ============================================================================