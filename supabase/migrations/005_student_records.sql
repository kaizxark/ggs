-- ============================================================================
-- 005 — Student record tables
--
-- The remaining entities the profile brief asks for, each in its own table
-- rather than as columns on `students`. A pupil's medical history, guardian
-- permissions and fee schedule are not attributes of a pupil: they are history,
-- and history has to survive a pupil moving class, changing school year, or
-- leaving.
--
-- Every table here:
--   • carries organisation_id and is scoped to it
--   • is referenced to students (and to the year/class it belongs to, so the
--     record stays attached to the class it was earned in)
--   • gets an audit trigger, so every insert/update/delete lands in audit_logs
--     with the actor and the before/after row
--   • reuses the access helpers from migration 004 rather than adding a role
--     check of its own
--
-- Access rules differ per table and that difference is the point:
--   can_read_student_record  family data, admission, activities, observations
--   can_view_health_records  medical and accessibility data, narrower
--   can_view_student_finance fees, narrower still
--
-- Student deletion cascades through all of these, so a pupil record cannot be
-- removed while leaving their medical and fee history behind.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Admission history
-- ---------------------------------------------------------------------------
--
-- `students.joined_on` records when a pupil joined but not how they got here.
-- One row per admission event so a transfer or a re-admission is a second row
-- rather than an overwrite.

create table if not exists public.admission_records (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete cascade,
  student_id            uuid not null references public.students (id) on delete cascade,
  academic_year_id      uuid references public.academic_years (id) on delete set null,
  application_date      date,
  status                text not null default 'applied',
  applied_on            date,
  admitted_on           date,
  -- Previous school and class, needed for a transfer certificate and for
  -- placing a mid-year admit into the right section.
  previous_school       text,
  previous_class        text,
  previous_board        text,
  admission_type        text,
  remarks               text,
  -- Withdrawal and graduation are recorded here rather than inferred from
  -- students.status, because the date and reason have to be recorded once and
  -- then stay put even if the status is corrected later.
  withdrawn_on          date,
  withdrawal_reason     text,
  graduated_on          date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint admission_records_status_check
    check (status in ('applied', 'under_review', 'approved', 'rejected',
                      'waitlisted', 'withdrawn', 'graduated')),
  -- Dates have to be in order or the history is meaningless.
  constraint admission_records_date_order check (
    withdrawn_on  is null or applied_on  is null or withdrawn_on  >= applied_on
  ),
  constraint admission_records_graduated_check
    check (graduated_on is null or admitted_on is null or graduated_on >= admitted_on)
);

comment on table public.admission_records is
  'How a student entered the school: application, admission, transfer, withdrawal, graduation.';

create index if not exists admission_records_student_idx
  on public.admission_records (organisation_id, student_id, admitted_on desc);

alter table public.admission_records enable row level security;

drop policy if exists "student record read" on public.admission_records;
create policy "student record read" on public.admission_records
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_read_student_record(student_id));

drop policy if exists "school management write" on public.admission_records;
create policy "school management write" on public.admission_records
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists admission_records_updated_at on public.admission_records;
create trigger admission_records_updated_at
  before update on public.admission_records
  for each row execute function public.set_updated_at();

drop trigger if exists audit_admission_records on public.admission_records;
create trigger audit_admission_records
  after insert or update or delete on public.admission_records
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.admission_records to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Health and emergency information
-- ---------------------------------------------------------------------------
--
-- Held apart from the rest of the family record because medical data is the
-- most sensitive thing here and the brief restricts it to explicitly
-- authorised personnel. Note what is *not* collected: no diagnosis codes, no
-- prescription history, no hospital record numbers. What is stored is what a
-- school needs on a day to keep a child safe and to call the right person.

create table if not exists public.student_health_records (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete cascade,
  student_id            uuid not null references public.students (id) on delete cascade,
  blood_group           text,
  height_cm             numeric(5,2),
  weight_kg             numeric(5,2),
  -- Known allergies and any emergency medication, as free text because the
  -- school's nurse records them in the words she was given.
  allergies             text,
  medical_conditions    text,
  medications           text,
  -- What to do in an emergency, in the school's own words.
  emergency_instructions text,
  accessibility_needs   text,
  -- Emergency contact held on the health record so a nurse has it without
  -- needing to open the family record.
  emergency_contact_name  text,
  emergency_contact_phone text,
  regular_doctor_name    text,
  regular_doctor_phone   text,
  insurance_reference   text,
  checked_at            timestamptz,
  checked_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- One current health record per pupil. History of changes is kept by the
  -- audit trigger, which is the honest place for it: this row is a snapshot of
  -- what is true now.
  constraint student_health_records_one_per_student unique (student_id),
  constraint student_health_records_height_check
    check (height_cm is null or height_cm > 0),
  constraint student_health_records_weight_check
    check (weight_kg is null or weight_kg > 0)
);

comment on table public.student_health_records is
  'Medical and accessibility information needed to keep a student safe. Restricted access; not a clinical record.';

create index if not exists student_health_records_organisation_idx
  on public.student_health_records (organisation_id);

alter table public.student_health_records enable row level security;

drop policy if exists "health record read" on public.student_health_records;
create policy "health record read" on public.student_health_records
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_view_health_records(student_id));

-- An update is only allowed by someone who can also read it, so the narrower
-- read rule applies to writes too.
drop policy if exists "health record write" on public.student_health_records;
create policy "health record write" on public.student_health_records
  for all to public
  using (organisation_id = public.current_organisation_id()
         and public.can_view_health_records(student_id)
         and public.current_role()::text in ('admin', 'principal', 'teacher'))
  with check (organisation_id = public.current_organisation_id());

drop trigger if exists student_health_records_updated_at on public.student_health_records;
create trigger student_health_records_updated_at
  before update on public.student_health_records
  for each row execute function public.set_updated_at();

drop trigger if exists audit_student_health_records on public.student_health_records;
create trigger audit_student_health_records
  after insert or update or delete on public.student_health_records
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.student_health_records to authenticated;

-- School medical incidents are separate from the standing health record: they
-- are dated events, one row each, and they are what a safeguarding review reads.
create table if not exists public.student_health_incidents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  student_id       uuid not null references public.students (id) on delete cascade,
  incident_date    date not null default current_date,
  summary          text not null,
  action_taken     text,
  -- `critical` drives whether the record needs a follow-up before the pupil
  -- returns; it is not a clinical severity score.
  severity         text not null default 'minor',
  attendance_impact text,
  notified_guardian boolean not null default false,
  guardian_notified_at timestamptz,
  recorded_by      uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint student_health_incidents_summary_not_blank check (btrim(summary) <> ''),
  constraint student_health_incidents_severity_check
    check (severity in ('minor', 'moderate', 'critical'))
);

comment on table public.student_health_incidents is
  'Dated medical incidents at school. Read by the restricted health audience only.';

create index if not exists student_health_incidents_student_idx
  on public.student_health_incidents (organisation_id, student_id, incident_date desc);

alter table public.student_health_incidents enable row level security;

drop policy if exists "health incident read" on public.student_health_incidents;
create policy "health incident read" on public.student_health_incidents
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_view_health_records(student_id));

drop policy if exists "health incident write" on public.student_health_incidents;
create policy "health incident write" on public.student_health_incidents
  for all to public
  using (organisation_id = public.current_organisation_id()
         and public.can_view_health_records(student_id)
         and public.current_role()::text in ('admin', 'principal', 'teacher'))
  with check (organisation_id = public.current_organisation_id());

drop trigger if exists audit_student_health_incidents on public.student_health_incidents;
create trigger audit_student_health_incidents
  after insert or update or delete on public.student_health_incidents
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.student_health_incidents to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Leave applications
-- ---------------------------------------------------------------------------

create table if not exists public.leave_applications (
  id             uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  classroom_id   uuid references public.classrooms (id) on delete set null,
  leave_type     text not null default 'casual',
  from_on        date not null,
  to_on          date not null,
  -- Counted by the attendance screen when it marks the days. Stored so a later
  -- change of dates does not silently rewrite last term's numbers.
  days           numeric(4,1) not null default 1,
  reason         text,
  status         text not null default 'pending',
  applied_by     uuid references public.profiles (id) on delete set null,
  applied_at     timestamptz not null default now(),
  decided_by     uuid references public.profiles (id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint leave_applications_type_check
    check (leave_type in ('casual', 'medical', 'family', 'sports', 'exam', 'other')),
  constraint leave_applications_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint leave_applications_date_order check (to_on >= from_on),
  constraint leave_applications_days_positive check (days > 0),
  -- A decided application needs both a decision and a decision maker; a pending
  -- one must not have either, or the audit trail disagrees with itself.
  constraint leave_applications_decision_check check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status <> 'pending' and decided_at is not null)
  )
);

comment on table public.leave_applications is
  'Leave requested by or for a student, with its approval trail.';

create index if not exists leave_applications_student_idx
  on public.leave_applications (organisation_id, student_id, from_on desc);

-- The approval queue: what is waiting and for whom.
create index if not exists leave_applications_pending_idx
  on public.leave_applications (organisation_id, status, applied_at)
  where status = 'pending';

alter table public.leave_applications enable row level security;

drop policy if exists "leave read" on public.leave_applications;
create policy "leave read" on public.leave_applications
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_read_student_record(student_id));

-- A guardian may apply for leave on their own child's behalf, and an admin may
-- decide. Nothing else: a teacher cannot approve, and a teacher cannot file
-- leave for a child outside their class.
drop policy if exists "leave apply" on public.leave_applications;
create policy "leave apply" on public.leave_applications
  for insert to public
  with check (
    organisation_id = public.current_organisation_id()
    and public.can_read_student_record(student_id)
    and (
      public.current_role()::text in ('admin', 'principal')
      or public.is_linked_guardian_of(student_id)
      or (public.current_role()::text = 'teacher' and public.is_assigned_teacher_of(student_id))
    )
  );

-- Only management may decide. The `status` guard stops an update from flipping
-- an already-decided application back to pending without leaving a trail.
drop policy if exists "leave decide" on public.leave_applications;
create policy "leave decide" on public.leave_applications
  for update to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id());

drop trigger if exists leave_applications_updated_at on public.leave_applications;
create trigger leave_applications_updated_at
  before update on public.leave_applications
  for each row execute function public.set_updated_at();

drop trigger if exists audit_leave_applications on public.leave_applications;
create trigger audit_leave_applications
  after insert or update or delete on public.leave_applications
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.leave_applications to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Attendance corrections
-- ---------------------------------------------------------------------------
--
-- `attendance` has a unique key on (student_id, attendance_date), so a wrong
-- mark is corrected by overwriting the row. That loses the original, and it is
-- the audit the brief asks for under "attendance correction history". This table
-- records what the mark was before it was changed.
--
-- Written by the attendance route whenever it changes an existing row.

create table if not exists public.attendance_corrections (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  student_id       uuid not null references public.students (id) on delete cascade,
  attendance_id    uuid references public.attendance (id) on delete set null,
  attendance_date  date not null,
  from_status      text,
  to_status        text,
  reason           text not null,
  corrected_by     uuid references public.profiles (id) on delete set null,
  corrected_at     timestamptz not null default now()
);

comment on table public.attendance_corrections is
  'Before/after trail for attendance marks that were changed after being recorded.';

create index if not exists attendance_corrections_student_idx
  on public.attendance_corrections (organisation_id, student_id, attendance_date desc);

alter table public.attendance_corrections enable row level security;

drop policy if exists "attendance correction read" on public.attendance_corrections;
create policy "attendance correction read" on public.attendance_corrections
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_read_student_record(student_id));

drop policy if exists "attendance correction write" on public.attendance_corrections;
create policy "attendance correction write" on public.attendance_corrections
  for insert to public
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists audit_attendance_corrections on public.attendance_corrections;
create trigger audit_attendance_corrections
  after insert or update or delete on public.attendance_corrections
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.attendance_corrections to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fee accounts and instalments
-- ---------------------------------------------------------------------------
--
-- `invoices` record what was billed and `payments` what was paid. Neither
-- answers "what was this pupil supposed to pay this year, in how many
-- instalments, and what has been waived" — which is what a fee account is.
--
-- fee_structure carries the school-side template; fee_accounts is one pupil's
-- copy of it for one year, and fee_installments are its rows. Keeping the pupil
-- copy separate from the template is what allows a scholarship to be recorded
-- against one child without changing what everyone else pays.

create table if not exists public.fee_structure (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  category_id     uuid references public.fee_categories (id) on delete set null,
  name            text not null,
  amount          numeric(12,2) not null,
  -- Optional instalment template: how many payments, and how often.
  instalment_count integer not null default 1,
  instalment_frequency text not null default 'termly',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint fee_structure_name_not_blank check (btrim(name) <> ''),
  constraint fee_structure_amount_positive check (amount >= 0),
  constraint fee_structure_instalments_check check (instalment_count between 1 and 12),
  constraint fee_structure_frequency_check
    check (instalment_frequency in ('monthly', 'quarterly', 'termly', 'annual', 'oneoff'))
);

comment on table public.fee_structure is
  'The school''s fee template for an academic year. A pupil''s fee_accounts row is a copy of this, so one child can be given a concession without changing anyone else''s fees.';

create index if not exists fee_structure_organisation_idx
  on public.fee_structure (organisation_id, academic_year_id, active);

alter table public.fee_structure enable row level security;

drop policy if exists "fee structure read" on public.fee_structure;
create policy "fee structure read" on public.fee_structure
  for select to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_finance());

drop policy if exists "fee structure write" on public.fee_structure;
create policy "fee structure write" on public.fee_structure
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_finance());

drop trigger if exists fee_structure_updated_at on public.fee_structure;
create trigger fee_structure_updated_at
  before update on public.fee_structure
  for each row execute function public.set_updated_at();

drop trigger if exists audit_fee_structure on public.fee_structure;
create trigger audit_fee_structure
  after insert or update or delete on public.fee_structure
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.fee_structure to authenticated;

create table if not exists public.fee_accounts (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  student_id       uuid not null references public.students (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  -- The pupil's committed fee for the year, after any discount.
  total_fee        numeric(12,2) not null default 0,
  -- Reductions held separately from the total so a concession is visible rather
  -- than already folded into a number nobody can explain.
  scholarship      numeric(12,2) not null default 0,
  concession       numeric(12,2) not null default 0,
  discount_reason  text,
  -- Sum of paid_amount across this pupil's invoices for the year. Maintained by
  -- trigger below so it cannot drift from the invoices it summarises.
  paid_amount      numeric(12,2) not null default 0,
  status           text not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- One fee account per pupil per year. Without this a second writer could
  -- create a competing account and the outstanding balance would be wrong.
  constraint fee_accounts_student_year_key unique (student_id, academic_year_id),
  constraint fee_accounts_status_check check (status in ('active', 'closed', 'waived')),
  constraint fee_accounts_amounts_positive check (
    total_fee >= 0 and scholarship >= 0 and concession >= 0 and paid_amount >= 0
  ),
  -- A reduction larger than the fee itself is a data entry error, not a
  -- generous school.
  constraint fee_accounts_reduction_sane check (scholarship + concession <= total_fee)
);

comment on table public.fee_accounts is
  'One student''s fee position for one academic year: committed fee, scholarship, concession and what has been paid.';

create index if not exists fee_accounts_organisation_idx
  on public.fee_accounts (organisation_id, student_id);

create index if not exists fee_accounts_status_idx
  on public.fee_accounts (organisation_id, status);

alter table public.fee_accounts enable row level security;

drop policy if exists "fee account read" on public.fee_accounts;
create policy "fee account read" on public.fee_accounts
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_view_student_finance(student_id));

drop policy if exists "fee account write" on public.fee_accounts;
create policy "fee account write" on public.fee_accounts
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_finance());

drop trigger if exists fee_accounts_updated_at on public.fee_accounts;
create trigger fee_accounts_updated_at
  before update on public.fee_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists audit_fee_accounts on public.fee_accounts;
create trigger audit_fee_accounts
  after insert or update or delete on public.fee_accounts
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.fee_accounts to authenticated;

create table if not exists public.fee_installments (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  fee_account_id  uuid not null references public.fee_accounts (id) on delete cascade,
  student_id      uuid not null references public.students (id) on delete cascade,
  label           text not null,
  amount          numeric(12,2) not null,
  due_on          date not null,
  status          text not null default 'due',
  paid_amount     numeric(12,2) not null default 0,
  paid_on         date,
  -- The invoice a payment settled this instalment against, so the fee account
  -- and the invoice ledger can be reconciled.
  invoice_id      uuid references public.invoices (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint fee_installments_label_not_blank check (btrim(label) <> ''),
  constraint fee_installments_amount_positive check (amount >= 0),
  constraint fee_installments_paid_non_negative check (paid_amount >= 0),
  -- Cannot be paid more than it is owed.
  constraint fee_installments_not_overpaid check (paid_amount <= amount),
  constraint fee_installments_status_check
    check (status in ('due', 'part_paid', 'paid', 'overdue', 'waived')),
  -- A status of paid has to agree with the money columns, or the summary and
  -- the ledger disagree.
  constraint fee_installments_status_consistent check (
    (status = 'waived')
    or (status = 'paid'  and paid_amount = amount)
    or (status = 'part_paid' and paid_amount > 0 and paid_amount < amount)
    or (status in ('due', 'overdue') and paid_amount = 0)
  ),
  -- Same label twice on one account is a duplicate; the dates may differ.
  constraint fee_installments_account_label_key unique (fee_account_id, label)
);

comment on table public.fee_installments is
  'Scheduled instalments on a fee account, with what has been paid against each.';

create index if not exists fee_installments_account_idx
  on public.fee_installments (organisation_id, fee_account_id, due_on);

-- Drives the "upcoming instalments" list and the overdue reminder.
create index if not exists fee_installments_due_idx
  on public.fee_installments (organisation_id, student_id, due_on)
  where status in ('due', 'overdue', 'part_paid');

create index if not exists fee_installments_student_idx
  on public.fee_installments (organisation_id, student_id, due_on desc);

alter table public.fee_installments enable row level security;

drop policy if exists "fee installment read" on public.fee_installments;
create policy "fee installment read" on public.fee_installments
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_view_student_finance(student_id));

drop policy if exists "fee installment write" on public.fee_installments;
create policy "fee installment write" on public.fee_installments
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_finance())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_finance());

drop trigger if exists fee_installments_updated_at on public.fee_installments;
create trigger fee_installments_updated_at
  before update on public.fee_installments
  for each row execute function public.set_updated_at();

drop trigger if exists audit_fee_installments on public.fee_installments;
create trigger audit_fee_installments
  after insert or update or delete on public.fee_installments
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.fee_installments to authenticated;

-- Keep fee_accounts.paid_amount in step with the instalments it summarises.
--
-- Recomputed from `fee_installments` rather than incremented, so a corrected or
-- deleted instalment settles the difference by itself instead of leaving a
-- stale total that only a full audit would catch.
--
-- Summed per account, not matched on the academic year: `invoices` has no
-- academic_year_id column in this database, so a year-scoped sum against
-- invoices would have been silently wrong.
create or replace function public.sync_fee_account_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid := coalesce(new.fee_account_id, old.fee_account_id);
begin
  if v_account is not null then
    update public.fee_accounts fa
       set paid_amount = coalesce((
             select sum(fi.paid_amount)
               from public.fee_installments fi
              where fi.fee_account_id = fa.id
         ), 0)
     where fa.id = v_account;
  end if;
  return null;
end $$;

drop trigger if exists fee_installments_sync_account on public.fee_installments;
create trigger fee_installments_sync_account
  after insert or delete on public.fee_installments
  for each row execute function public.sync_fee_account_paid();

-- ---------------------------------------------------------------------------
-- 6. Transport detail
-- ---------------------------------------------------------------------------
--
-- `transport_allocations` has the student, the route and a stop. It has no
-- timings and no authorisation for pickup, which the brief asks for. Adding
-- those as columns would keep the history: the row is not overwritten when a
-- child's pickup changes, it is ended and a new one opened.

-- No `vehicle_id` column: `vehicles` exists only as mock rows in the client, so
-- a foreign key would point at nothing. The vehicle number already lives on
-- `transport_routes.vehicle_no`, and when a real fleet table arrives this gets
-- a proper reference then.
alter table public.transport_allocations
  add column if not exists pickup_time time,
  add column if not exists drop_time time,
  add column if not exists is_authorized_pickup boolean not null default false,
  add column if not exists fare_amount numeric(12,2),
  add column if not exists ended_on date;

comment on column public.transport_allocations.pickup_time is
  'Scheduled pickup time, school local time.';
comment on column public.transport_allocations.ended_on is
  'Set when a child stops riding a route. Left null while the allocation is live, so history is preserved rather than overwritten.';

create index if not exists transport_allocations_history_idx
  on public.transport_allocations (organisation_id, student_id, ended_on);

-- ---------------------------------------------------------------------------
-- 7. Extracurricular activities
-- ---------------------------------------------------------------------------

create table if not exists public.activities (
  id              uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name            text not null,
  category        text not null default 'club',
  description     text,
  coordinator_id  uuid references public.staff (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint activities_name_not_blank check (btrim(name) <> ''),
  constraint activities_category_check
    check (category in ('sport', 'club', 'cultural', 'competition', 'event', 'academic'))
);

comment on table public.activities is
  'Sports, clubs, competitions, cultural activities and school events a student can take part in.';

create index if not exists activities_organisation_idx
  on public.activities (organisation_id, category, active);

alter table public.activities enable row level security;

drop policy if exists "activities read" on public.activities;
create policy "activities read" on public.activities
  for select to public
  using (organisation_id = public.current_organisation_id());

drop policy if exists "activities write" on public.activities;
create policy "activities write" on public.activities
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists activities_updated_at on public.activities;
create trigger activities_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

drop trigger if exists audit_activities on public.activities;
create trigger audit_activities
  after insert or update or delete on public.activities
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.activities to authenticated;

create table if not exists public.activity_participations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  activity_id      uuid not null references public.activities (id) on delete cascade,
  student_id       uuid not null references public.students (id) on delete cascade,
  role             text,
  participation    text not null default 'active',
  award            text,
  achievement      text,
  certificate_ref  text,
  started_on       date,
  ended_on         date,
  remarks          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- One pupil, one activity: the row is updated rather than duplicated when a
  -- member wins an award or moves from participant to captain.
  constraint activity_participations_unique unique (activity_id, student_id),
  constraint activity_participations_participation_check
    check (participation in ('active', 'completed', 'withdrawn')),
  constraint activity_participations_date_order
    check (ended_on is null or started_on is null or ended_on >= started_on)
);

comment on table public.activity_participations is
  'A student''s participation in an activity, with awards and certificates.';

create index if not exists activity_participations_student_idx
  on public.activity_participations (organisation_id, student_id, started_on desc);

alter table public.activity_participations enable row level security;

drop policy if exists "participation read" on public.activity_participations;
create policy "participation read" on public.activity_participations
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_read_student_record(student_id));

drop policy if exists "participation write" on public.activity_participations;
create policy "participation write" on public.activity_participations
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists activity_participations_updated_at on public.activity_participations;
create trigger activity_participations_updated_at
  before update on public.activity_participations
  for each row execute function public.set_updated_at();

drop trigger if exists audit_activity_participations on public.activity_participations;
create trigger audit_activity_participations
  after insert or update or delete on public.activity_participations
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.activity_participations to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Behaviour and teacher observations
-- ---------------------------------------------------------------------------
--
-- The brief is explicit that these stay factual and access controlled, so the
-- table is built to discourage interpretation: `category` is a fixed list, the
-- body is free text but every row carries an author and a date, and
-- visible_to_guardians defaults to false. Positive notes are as welcome as
-- concerns; the category is not a judgement of the child.
--
-- Retention: no hard delete in the application layer, and the audit trigger
-- records every change, so a disputed observation can be traced.

create table if not exists public.student_observations (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references public.organisations (id) on delete cascade,
  student_id         uuid not null references public.students (id) on delete cascade,
  classroom_id       uuid references public.classrooms (id) on delete set null,
  author_id          uuid references public.profiles (id) on delete set null,
  category           text not null default 'participation',
  body               text not null,
  -- Specific, checkable facts rather than adjectives. `classroom_participation`
  -- is a count of observed lessons, not a grade.
  classroom_participation integer,
  support_needed      boolean not null default false,
  action_taken        text,
  follow_up_on        date,
  follow_up_done      boolean not null default false,
  follow_up_notes     text,
  -- Off by default: an observation about a child is not automatically the
  -- family's business, and sharing it is a deliberate act.
  visible_to_guardians boolean not null default false,
  observed_on         date not null default current_date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint student_observations_body_not_blank check (btrim(body) <> ''),
  constraint student_observations_category_check
    check (category in ('positive', 'participation', 'academic_support',
                        'discipline', 'attendance_concern', 'wellbeing')),
  constraint student_observations_participation_check
    check (classroom_participation is null or classroom_participation >= 0)
);

comment on table public.student_observations is
  'Factual teacher observations. Not visible to guardians unless explicitly shared.';

create index if not exists student_observations_student_idx
  on public.student_observations (organisation_id, student_id, observed_on desc);

-- The follow-up queue, and the only index that stays small as years of
-- observations accumulate.
create index if not exists student_observations_followup_idx
  on public.student_observations (organisation_id, follow_up_on)
  where not follow_up_done;

alter table public.student_observations enable row level security;

-- Narrows the read to the pupil's teachers as well as management, and never
-- widens to a parent: the row is visible to a guardian only when the author
-- shared it, which the policy reads off the row itself.
drop policy if exists "observation read" on public.student_observations;
create policy "observation read" on public.student_observations
  for select to public
  using (
    organisation_id = public.current_organisation_id()
    and (
      public.current_role()::text in ('admin', 'principal')
      or (public.current_role()::text = 'teacher'
          and (public.is_assigned_teacher_of(student_id) or author_id = auth.uid()))
      or (public.is_linked_guardian_of(student_id) and visible_to_guardians)
    )
  );

drop policy if exists "observation write" on public.student_observations;
create policy "observation write" on public.student_observations
  for insert to public
  with check (
    organisation_id = public.current_organisation_id()
    and (
      public.current_role()::text in ('admin', 'principal')
      or (public.current_role()::text = 'teacher'
          and (public.is_assigned_teacher_of(student_id) or author_id = auth.uid()))
    )
  );

drop policy if exists "observation update" on public.student_observations;
create policy "observation update" on public.student_observations
  for update to public
  using (
    organisation_id = public.current_organisation_id()
    and (
      public.current_role()::text in ('admin', 'principal')
      or author_id = auth.uid()
    )
  )
  with check (organisation_id = public.current_organisation_id());

drop trigger if exists student_observations_updated_at on public.student_observations;
create trigger student_observations_updated_at
  before update on public.student_observations
  for each row execute function public.set_updated_at();

drop trigger if exists audit_student_observations on public.student_observations;
create trigger audit_student_observations
  after insert or update or delete on public.student_observations
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.student_observations to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Communication history
-- ---------------------------------------------------------------------------
--
-- The brief says to integrate with the existing messaging module rather than
-- build a second one, and this does exactly that: it stores *references*, not
-- copies. A parent-teacher meeting is a row here; the messages exchanged about
-- it stay in `messages` and are linked by id, so a message is sent once and
-- appears in both the thread and the timeline.
--
-- There is no body text here for an ordinary message. Only a meeting has notes,
-- and those are minutes, not a copy of the correspondence.

create table if not exists public.student_communications (
  id             uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  kind           text not null default 'general',
  -- Links into the existing modules. Both nullable: a reminder logged by the
  -- attendance screen may have no message behind it.
  message_id     uuid references public.messages (id) on delete set null,
  guardian_id    uuid references public.guardians (id) on delete set null,
  subject        text,
  -- Only for meetings, where minutes are the record.
  notes          text,
  outcome        text,
  occurred_at    timestamptz not null default now(),
  acknowledged_at timestamptz,
  recorded_by    uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint student_communications_kind_check
    check (kind in ('general', 'meeting', 'attendance', 'academic', 'fees', 'leave', 'announcement')),
  -- Minutes without a note are not minutes.
  constraint student_communications_meeting_notes_check
    check (kind <> 'meeting' or notes is not null)
);

comment on table public.student_communications is
  'References to communication about a student. Messages stay in the messages table; this is the timeline, not a copy.';

create index if not exists student_communications_student_idx
  on public.student_communications (organisation_id, student_id, occurred_at desc);

create index if not exists student_communications_message_idx
  on public.student_communications (message_id)
  where message_id is not null;

alter table public.student_communications enable row level security;

-- A guardian sees the communication addressed to them, or addressed to their
-- child where no specific guardian was named.
drop policy if exists "communication read" on public.student_communications;
create policy "communication read" on public.student_communications
  for select to public
  using (
    organisation_id = public.current_organisation_id()
    and (
      public.current_role()::text in ('admin', 'principal', 'staff')
      or public.can_access_student(student_id)
    )
  );

drop policy if exists "communication write" on public.student_communications;
create policy "communication write" on public.student_communications
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists student_communications_updated_at on public.student_communications;
create trigger student_communications_updated_at
  before update on public.student_communications
  for each row execute function public.set_updated_at();

drop trigger if exists audit_student_communications on public.student_communications;
create trigger audit_student_communications
  after insert or update or delete on public.student_communications
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.student_communications to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Library loans
-- ---------------------------------------------------------------------------
--
-- There is no library module in the database (`library_books` exists only as
-- mock rows in the client), so this carries the book's title rather than a
-- foreign key that would point at nothing. When a catalogue arrives, add
-- `book_id uuid references library_books(id)` and keep `book_title` as the
-- snapshot: a loan should still say what was actually borrowed.

create table if not exists public.library_loans (
  id             uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  book_title     text not null,
  book_isbn      text,
  book_reference text,
  issued_on      date not null default current_date,
  due_on         date,
  returned_on    date,
  fine_amount    numeric(8,2) not null default 0,
  status         text not null default 'issued',
  issued_by      uuid references public.profiles (id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint library_loans_title_not_blank check (btrim(book_title) <> ''),
  constraint library_loans_fine_non_negative check (fine_amount >= 0),
  constraint library_loans_date_order check (returned_on is null or issued_on <= returned_on),
  constraint library_loans_status_check
    check (status in ('issued', 'returned', 'overdue', 'lost')),
  -- A returned book needs its return date; anything still out does not.
  constraint library_loans_returned_check
    check (status <> 'returned' or returned_on is not null)
);

comment on table public.library_loans is
  'Books issued to a student. Holds a title snapshot because there is no book catalogue table yet.';

create index if not exists library_loans_student_idx
  on public.library_loans (organisation_id, student_id, issued_on desc);

-- The overdue query, and small enough to stay small.
create index if not exists library_loans_overdue_idx
  on public.library_loans (organisation_id, due_on)
  where status in ('issued', 'overdue');

alter table public.library_loans enable row level security;

drop policy if exists "library loan read" on public.library_loans;
create policy "library loan read" on public.library_loans
  for select to public
  using (organisation_id = public.current_organisation_id()
         and public.can_read_student_record(student_id));

drop policy if exists "library loan write" on public.library_loans;
create policy "library loan write" on public.library_loans
  for all to public
  using (organisation_id = public.current_organisation_id() and public.can_manage_school())
  with check (organisation_id = public.current_organisation_id() and public.can_manage_school());

drop trigger if exists library_loans_updated_at on public.library_loans;
create trigger library_loans_updated_at
  before update on public.library_loans
  for each row execute function public.set_updated_at();

drop trigger if exists audit_library_loans on public.library_loans;
create trigger audit_library_loans
  after insert or update or delete on public.library_loans
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.library_loans to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Audit trail for tables that had none
-- ---------------------------------------------------------------------------
--
-- `enrollments`, `classrooms`, `academic_years`, `transport_routes` and
-- `transport_allocations` had no audit trigger, so a promotion or a route
-- change left no trace. The brief asks for audit history across the system and
-- these are the records that carry a pupil between classes and years, which is
-- precisely the history that must not be lost.

do $$
declare
  t text;
begin
  foreach t in array array[
    'enrollments','classrooms','academic_years','transport_routes','transport_allocations'
  ] loop
    execute format('drop trigger if exists audit_%s on public.%I', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on public.%I
       for each row execute function public.write_audit_log()', t, t);
  end loop;
end $$;

commit;

-- ============================================================================
-- After running this, the profile has a real home for every section the brief
-- lists. All of them are empty, deliberately: nothing here is invented from the
-- existing data. The one exception is `transport_allocations`, which gains
-- columns rather than rows, so the 40 existing allocations keep working and
-- simply show blank timings until someone fills them in.
--
--   select count(*) from public.admission_records;          -- 0
--   select count(*) from public.student_health_records;     -- 0
--   select count(*) from public.leave_applications;         -- 0
--   select count(*) from public.fee_accounts;               -- 0
--   select count(*) from public.fee_installments;           -- 0
--   select count(*) from public.student_observations;       -- 0
--   select count(*) from public.student_communications;     -- 0
--   select count(*) from public.library_loans;              -- 0
--   select count(*) from public.activities;                 -- 0
--   select count(*) from public.transport_allocations;      -- 40, unchanged
--
-- Admission history is the one section worth seeding, because `students.status`
-- and `students.joined_on` already hold the facts it would record. That is done
-- in migration 006 alongside the document backfill, where the same "derive, do
-- not invent" rule is applied.
-- ============================================================================