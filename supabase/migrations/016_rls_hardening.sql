-- ============================================================================
-- 016 — Row level security hardening
--
-- ## Why this migration exists
--
-- `supabase/schema.sql` enabled RLS on every core table and then granted
-- *everything* to `authenticated`:
--
--     create policy "authenticated read"  ... using (true)
--     create policy "authenticated write" ... using (true) with check (true)
--
-- The browser talks to Postgres directly with the anon key, so "authenticated"
-- includes every pupil and every parent. In practice that meant any signed-in
-- person could read `students`, `invoices`, `payments`, `exam_results` and
-- `settings`, and could write to them, by opening the console. The role checks
-- in `api/*` protect only the routes the UI happens to call; the database was
-- the open door behind them.
--
-- This file drops every existing policy on the school's tables and rebuilds
-- them around the record-level helpers that migrations 004–007 already
-- installed. Nothing here changes the client: queries that were previously
-- unlimited now return only the rows the caller is entitled to see.
--
-- Safe to run more than once: policies are dropped by name from `pg_policies`
-- before being recreated, and helper functions use `create or replace`.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The verbs
-- ---------------------------------------------------------------------------
-- Small, named predicates rather than the same four-role list repeated in
-- thirty policies. `current_role()` and `is_school_owner()` already exist in
-- the live database (migrations 004 and 007); these wrap them and add the
-- super admin, who is recognised by immutable user id.

-- Anyone who works at the school in a non-teaching capacity, plus teachers.
create or replace function public.is_school_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_school_owner(auth.uid())
      or public.current_role()::text in ('admin', 'principal', 'staff', 'accountant', 'teacher');
$$;

-- Roles that may see every pupil in the school. A teacher is deliberately
-- absent: they see the classes they are assigned to, through
-- `can_access_student()`.
create or replace function public.sees_whole_school()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_school_owner(auth.uid())
      or public.current_role()::text in ('admin', 'principal', 'staff', 'accountant');
$$;

-- Roles that may change school-wide configuration.
create or replace function public.is_school_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_school_owner(auth.uid())
      or public.current_role()::text in ('admin', 'principal');
$$;

-- Money. The live `can_manage_finance()` predates the super-admin role, so the
-- owner is added explicitly rather than assumed.
create or replace function public.can_manage_all_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_school_owner(auth.uid())
      or public.can_manage_finance();
$$;

-- The record-level read predicates, widened where a helper predates
-- `super_admin`.
create or replace function public.can_read_record(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sees_whole_school()
      or public.can_access_student(p_student);
$$;

create or replace function public.can_see_health(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_school_owner(auth.uid())
      or public.current_role()::text in ('admin', 'principal')
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

create or replace function public.can_see_finance(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_all_finance()
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

-- A payment belongs to an invoice, which belongs to a pupil.
create or replace function public.can_see_invoice(p_invoice uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invoices i
     where i.id = p_invoice
       and i.organisation_id = public.current_organisation_id()
       and public.can_see_finance(i.student_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove the old policies, every one of them
-- ---------------------------------------------------------------------------
-- Dropping by name rather than by a fixed list: the names in the live project
-- are not all the ones this repository wrote, and a policy that is missed here
-- stays OR-ed with the new ones and re-opens the hole.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'organisations', 'profiles', 'students', 'staff',
    'academic_years', 'classrooms', 'enrollments', 'subjects',
    'subject_teachers', 'activities', 'activity_participations',
    'attendance', 'attendance_corrections', 'examinations', 'exam_results',
    'assignments', 'leave_applications', 'library_loans',
    'fee_categories', 'fee_structure', 'fee_accounts',
    'fee_installments', 'invoices', 'invoice_items', 'payments',
    'announcements', 'messages', 'notifications',
    'student_documents', 'student_guardians', 'guardians',
    'student_health_records', 'student_health_incidents',
    'student_observations', 'student_communications', 'admission_records',
    'transport_routes', 'transport_allocations',
    'settings', 'audit_logs',
    'invitations', 'student_credentials', 'staff_credentials', 'login_otp_codes'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    for p in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. School core
-- ---------------------------------------------------------------------------

create policy "students read" on public.students
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (public.sees_whole_school() or public.can_access_student(id))
  );

create policy "students write" on public.students
  for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.sees_whole_school()
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.sees_whole_school()
  );

create policy "staff read" on public.staff
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );

create policy "staff write" on public.staff
  for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_manager()
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.is_school_manager()
  );

create policy "organisations read" on public.organisations
  for select to authenticated
  using (id = public.current_organisation_id());

create policy "organisations write" on public.organisations
  for update to authenticated
  using (id = public.current_organisation_id() and public.is_school_manager())
  with check (id = public.current_organisation_id() and public.is_school_manager());

-- ---------------------------------------------------------------------------
-- 4. Profiles
-- ---------------------------------------------------------------------------
-- Read: your own row, or anybody's if you work at the school and are in the
-- same organisation. Write: your own row (name, avatar, username), or anybody
-- in your school if you are a manager. Role changes are guarded separately by
-- a trigger below, because RLS cannot restrict individual columns.

create policy "profiles read own or school" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      organisation_id = public.current_organisation_id()
      and public.is_school_employee()
    )
  );

create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles update school" on public.profiles
  for update to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_manager()
  )
  with check (
    organisation_id = public.current_organisation_id()
    and public.is_school_manager()
  );

-- A role is not a profile field. Without this, a pupil who can update their own
-- row can `update profiles set role = 'admin'` from the console.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The API writes with the service key, where `auth.uid()` is null and the
  -- caller's role arrives as a JWT claim. Those writes are already trusted.
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not (
      public.is_school_owner(auth.uid())
      or public.current_role()::text = 'admin'
    ) then
      raise exception 'Only an administrator may change a role'
        using errcode = '42501';
    end if;
  end if;

  if new.organisation_id is distinct from old.organisation_id then
    if not public.is_school_owner(auth.uid()) then
      raise exception 'Only the school owner may move a profile between schools'
        using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- 5. Academic structure
-- ---------------------------------------------------------------------------

create policy "structure read" on public.academic_years
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "structure write" on public.academic_years
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "classrooms read" on public.classrooms
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "classrooms write" on public.classrooms
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "enrollments read" on public.enrollments
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (public.sees_whole_school() or public.can_access_student(student_id))
  );
create policy "enrollments write" on public.enrollments
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "subjects read" on public.subjects
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "subjects write" on public.subjects
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "subject teachers read" on public.subject_teachers
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "subject teachers write" on public.subject_teachers
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "activities read" on public.activities
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "activities write" on public.activities
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "activity participation read" on public.activity_participations
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_read_record(student_id)
  );
create policy "activity participation write" on public.activity_participations
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_employee())
  with check (organisation_id = public.current_organisation_id() and public.is_school_employee());

-- ---------------------------------------------------------------------------
-- 6. Attendance and examinations
-- ---------------------------------------------------------------------------

create policy "attendance read" on public.attendance
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (public.is_school_employee() or public.can_access_student(student_id))
  );
create policy "attendance write" on public.attendance
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_employee())
  with check (organisation_id = public.current_organisation_id() and public.is_school_employee());

create policy "attendance corrections read" on public.attendance_corrections
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_access_student(student_id)
  );
create policy "attendance corrections write" on public.attendance_corrections
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_employee())
  with check (organisation_id = public.current_organisation_id() and public.is_school_employee());

create policy "examinations read" on public.examinations
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "examinations write" on public.examinations
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "exam results read" on public.exam_results
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (public.is_school_employee() or public.can_access_student(student_id))
  );
create policy "exam results write" on public.exam_results
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_employee())
  with check (organisation_id = public.current_organisation_id() and public.is_school_employee());

create policy "assignments read" on public.assignments
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "assignments write" on public.assignments
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_employee())
  with check (organisation_id = public.current_organisation_id() and public.is_school_employee());

create policy "leave read" on public.leave_applications
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_access_student(student_id)
  );
create policy "leave write" on public.leave_applications
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_employee())
  with check (organisation_id = public.current_organisation_id() and public.is_school_employee());

-- ---------------------------------------------------------------------------
-- 7. Money
-- ---------------------------------------------------------------------------
-- Read follows the pupil, not the table: an accountant sees every invoice, a
-- guardian sees the invoices of a child whose link grants fees, and nobody else
-- sees any.

create policy "fee structure read" on public.fee_structure
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "fee structure write" on public.fee_structure
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_manage_all_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_all_finance());

create policy "fee categories read" on public.fee_categories
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "fee categories write" on public.fee_categories
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_manage_all_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_all_finance());

create policy "fee accounts read" on public.fee_accounts
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_see_finance(student_id)
  );
create policy "fee accounts write" on public.fee_accounts
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_manage_all_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_all_finance());

create policy "fee installments read" on public.fee_installments
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_see_finance(student_id)
  );
create policy "fee installments write" on public.fee_installments
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_manage_all_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_all_finance());

create policy "invoices read" on public.invoices
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_see_finance(student_id)
  );
create policy "invoices write" on public.invoices
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_manage_all_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_all_finance());

create policy "invoice items read" on public.invoice_items
  for select to authenticated
  using (public.can_see_invoice(invoice_id));
create policy "invoice items write" on public.invoice_items
  for all to authenticated
  using (public.can_manage_all_finance())
  with check (public.can_manage_all_finance());

create policy "payments read" on public.payments
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_see_invoice(invoice_id)
  );
create policy "payments write" on public.payments
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_manage_all_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_all_finance());

-- ---------------------------------------------------------------------------
-- 8. Communication
-- ---------------------------------------------------------------------------

create policy "announcements read" on public.announcements
  for select to authenticated
  using (organisation_id = public.current_organisation_id());
create policy "announcements write" on public.announcements
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "messages read own" on public.messages
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  );
create policy "messages write own" on public.messages
  for all to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  )
  with check (
    organisation_id = public.current_organisation_id()
    and sender_id = auth.uid()
  );

create policy "notifications read own" on public.notifications
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and profile_id = auth.uid()
  );
create policy "notifications update own" on public.notifications
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 9. Student record tables (004–006)
-- ---------------------------------------------------------------------------
-- These already had record-level policies, but the blanket policy from
-- `schema.sql` was OR-ed with them and made them decorative. Rebuilt here on
-- the widened helpers.

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('student_documents',        'can_read_record',    'is_school_employee'),
      ('guardians',                null,                 'is_school_manager'),
      ('student_observations',     'can_read_record',    'is_school_employee'),
      ('student_communications',   'can_read_record',    'is_school_employee'),
      ('admission_records',        'can_read_record',    'is_school_manager'),
      ('library_loans',            'can_read_record',    'is_school_employee'),
      ('transport_allocations',    'can_read_record',    'is_school_employee')
    ) as v(tbl, read_fn, write_fn)
  loop
    if to_regclass(format('public.%I', spec.tbl)) is null then
      continue;
    end if;

    if spec.read_fn is not null then
      execute format(
        'create policy %I on public.%I for select to authenticated using (organisation_id = public.current_organisation_id() and public.%I(student_id))',
        spec.tbl || ' read', spec.tbl, spec.read_fn
      );
    else
      execute format(
        'create policy %I on public.%I for select to authenticated using (organisation_id = public.current_organisation_id() and public.is_school_employee())',
        spec.tbl || ' read', spec.tbl
      );
    end if;

    execute format(
      'create policy %I on public.%I for all to authenticated using (organisation_id = public.current_organisation_id() and public.%I()) with check (organisation_id = public.current_organisation_id() and public.%I())',
      spec.tbl || ' write', spec.tbl, spec.write_fn, spec.write_fn
    );
  end loop;
end
$$;

-- `student_guardians` links a guardian to a child. `guardians` has no
-- `student_id`, so it gets its own manager-scoped policy above via the loop's
-- null branch; the link table is read through the child.
create policy "student guardians read" on public.student_guardians
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and (
      public.sees_whole_school()
      or public.is_linked_guardian_of(student_id)
      or public.is_assigned_teacher_of(student_id)
    )
  );
create policy "student guardians write" on public.student_guardians
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

create policy "health records read" on public.student_health_records
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_see_health(student_id)
  );
create policy "health records write" on public.student_health_records
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_see_health(student_id))
  with check (organisation_id = public.current_organisation_id() and public.can_see_health(student_id));

create policy "health incidents read" on public.student_health_incidents
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.can_see_health(student_id)
  );
create policy "health incidents write" on public.student_health_incidents
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.can_see_health(student_id))
  with check (organisation_id = public.current_organisation_id() and public.can_see_health(student_id));

-- ---------------------------------------------------------------------------
-- 10. Transport
-- ---------------------------------------------------------------------------

create policy "transport routes read" on public.transport_routes
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_employee()
  );
create policy "transport routes write" on public.transport_routes
  for all to authenticated
  using (organisation_id = public.current_organisation_id() and public.is_school_manager())
  with check (organisation_id = public.current_organisation_id() and public.is_school_manager());

-- ---------------------------------------------------------------------------
-- 11. Settings and audit
-- ---------------------------------------------------------------------------
-- `settings` has no organisation column — this deployment serves one school —
-- so read is every signed-in member and write is a manager. The AI credential
-- stored here is sealed (AES-GCM) before it is written; see `shared/ai-config.ts`.

create policy "settings read" on public.settings
  for select to authenticated using (true);
create policy "settings write" on public.settings
  for all to authenticated
  using (public.is_school_manager())
  with check (public.is_school_manager());

create policy "audit read" on public.audit_logs
  for select to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.is_school_manager()
  );
-- No insert/update/delete policy: audit rows are written by SECURITY DEFINER
-- functions and the service role, never by a browser.

-- ---------------------------------------------------------------------------
-- 12. Credentials and invitations
-- ---------------------------------------------------------------------------
-- Deliberately no policies at all. RLS is enabled and nothing is granted, so
-- the tables are readable only with the service key — which is what the API
-- routes use. `student_credentials`/`staff_credentials` no longer hold a
-- password either; see section 13.

-- (No statements: the loop above dropped the old policies and left RLS on.)

-- ---------------------------------------------------------------------------
-- 13. Scrub the plaintext password mirror
-- ---------------------------------------------------------------------------
-- Auth is the only place a usable password lives, and it stores a hash. The
-- credential rows used to mirror the plaintext for the owner's screen. Before
-- scrubbing, record which accounts had already moved off their derived first
-- password, so the screen can say "set by the owner" instead of showing a date
-- of birth that no longer works.

update public.student_credentials c
   set last_rotated_at = coalesce(c.last_rotated_at, now())
  from public.students s
 where s.id = c.student_id
   and c.password <> '*'
   and s.date_of_birth is not null
   and c.password is distinct from to_char(s.date_of_birth, 'DDMMYY');

update public.student_credentials
   set password = '*'
 where password <> '*';

update public.staff_credentials c
   set last_rotated_at = coalesce(c.last_rotated_at, now())
  from public.staff s
 where s.id = c.staff_id
   and c.password <> '*'
   and s.joined_on is not null
   and c.password is distinct from to_char(s.joined_on, 'DDMMYY');

update public.staff_credentials
   set password = '*'
 where password <> '*';

commit;

-- ============================================================================
-- AFTER RUNNING
--
-- Verify with:
--
--   select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public' order by tablename, policyname;
--
--   -- As a pupil, this must return only their own row and no invoices:
--   select count(*) from public.students;
--   select count(*) from public.invoices;
--
-- Then rotate `SUPABASE_SECRET_KEY`: the old value was committed to the
-- repository and must be treated as public. Rotation invalidates the sealed AI
-- configuration (it is encrypted under that key); re-enter the provider key in
-- Settings afterwards.
-- ============================================================================
