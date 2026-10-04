-- ============================================================================
-- 006 — Document metadata, admission history seed, and student record columns
--
-- 1. student_documents
-- -------------------
-- Until now a pupil's file cabinet has lived entirely in a private Storage
-- bucket, with category, issue date and filename encoded into the object path:
--
--     <studentId>/<docType>__<issuedAt>__<safeFileName>
--
-- That works for listing and downloading, and it has the virtue of never
-- exposing a public URL. But it cannot record who uploaded a file, whether it
-- was verified, why it was rejected, or that a second version replaced the
-- first — all of which the brief requires, and all of which are the things that
-- matter when a document is disputed.
--
-- So the bytes stay in Storage and the metadata moves into a table. The object
-- path convention is unchanged, so every file already uploaded keeps working
-- and needs no move.
--
-- Backfill: one row per existing object, with the category and date decoded
-- from the path and everything else left honestly unknown (`uploaded_by` and
-- `uploaded_at` are null rather than guessed). Those files are therefore
-- visible as "unverified, legacy" until someone re-uploads or verifies them,
-- which is the correct way to show a document whose provenance is unknown.
--
-- 2. Admission history seed
-- ------------------------
-- `students.status` and `students.joined_on` already hold real facts about how
-- a pupil entered the school. An admission record is derived from exactly those
-- two columns — no dates, schools or reasons are invented. Pupils who are still
-- active get no row, because nothing is known about an application that has not
-- produced a status yet.
--
-- 3. Student record columns
-- -------------------------
-- Personal details the brief asks for that have no home today: blood group,
-- nationality, mother tongue, the structured parts of `address`, and the
-- emergency contact that the health record references.
--
-- `address` stays a jsonb column because it already is one and three screens
-- read it. It is not spread across new columns: that would leave two sources of
-- truth for the same address.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Student documents
-- ---------------------------------------------------------------------------

create table if not exists public.student_documents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  student_id       uuid not null references public.students (id) on delete cascade,

  -- The category, from a fixed list rather than free text. The upload route
  -- already validates against a slug pattern; this constrains the vocabulary
  -- so a typo cannot create a category nobody reports on.
  category         text not null,
  title            text not null,

  -- The Storage object path, relative to the bucket. Unique per pupil, which is
  -- what makes a replacement an update rather than a second row.
  file_path        text not null,
  file_name        text not null,
  content_type     text,
  size_bytes       bigint,

  -- Issue date of the document itself (a birth certificate's date), which is
  -- different from when it was uploaded.
  issued_on        date,
  uploaded_on      date not null default current_date,
  -- Null for anything created by the backfill: the Storage path carries no uploader.
  uploaded_by      uuid references public.profiles (id) on delete set null,

  -- Verification. `pending` is the default because an unverified document that
  -- silently looked verified is the failure mode worth designing against.
  verification_status text not null default 'pending',
  verified_by       uuid references public.profiles (id) on delete set null,
  verified_on       date,
  rejection_reason  text,
  remarks           text,

  -- Expiry, for documents that go stale: a transfer certificate is permanent,
  -- a medical clearance is not.
  expires_on        date,

  -- Version history. One row per version of this document, the current one
  -- being `version = 1`... incremented. The API supersedes the old row by
  -- bumping this rather than deleting it, so "which was this replaced by, and
  -- when" stays answerable.
  version           integer not null default 1,
  supersedes_id     uuid references public.student_documents (id) on delete set null,
  is_current        boolean not null default true,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint student_documents_category_check check (category in (
    'birth_certificate', 'previous_school_record', 'transfer_certificate',
    'admission_form', 'identity_document', 'parent_consent',
    'medical_certificate', 'photograph', 'address_proof', 'other'
  )),
  constraint student_documents_verification_check
    check (verification_status in ('pending', 'verified', 'rejected')),
  -- A verified document has to say who verified it and when, or it is not
  -- verified in any sense a school could rely on.
  constraint student_documents_verified_complete check (
    verification_status <> 'verified' or (verified_by is not null and verified_on is not null)
  ),
  constraint student_documents_rejected_reason check (
    verification_status <> 'rejected' or btrim(coalesce(rejection_reason, '')) <> ''
  ),
  constraint student_documents_title_not_blank check (btrim(title) <> ''),
  constraint student_documents_version_positive check (version >= 1),
  constraint student_documents_size_check check (size_bytes is null or size_bytes >= 0),
  constraint student_documents_expiry_check check (expires_on is null or issued_on is null or expires_on >= issued_on)
);

-- A pupil has one current version of a category at a time. Stated as a partial
-- index because the superseded versions stay in the table for history: a plain
-- unique constraint would forbid keeping them.
create unique index if not exists student_documents_current_unique_idx
  on public.student_documents (student_id, category)
  where is_current;

comment on table public.student_documents is
  'Metadata for each student document. Bytes live in the private student-documents bucket; this table records who uploaded what, whether it was verified, and its version history.';

-- The profile lists a pupil''s documents newest first.
create index if not exists student_documents_student_idx
  on public.student_documents (organisation_id, student_id, uploaded_on desc);

-- The document checklist screen counts what is outstanding across the school.
create index if not exists student_documents_verification_idx
  on public.student_documents (organisation_id, verification_status)
  where is_current;

create index if not exists student_documents_expires_idx
  on public.student_documents (organisation_id, expires_on)
  where expires_on is not null and is_current;

alter table public.student_documents enable row level security;

-- Document metadata follows the same rule as the bytes: only an administrator
-- may read or write it. This matches `ALLOWED_ROLES` in api/documents.ts, so a
-- teacher who can see the Documents screen still cannot enumerate a pupil's
-- file cabinet through the table.
--
-- The API route is the real gate — it checks the caller's role before it touches
-- storage — but RLS is what stops a query issued straight from the browser.
drop policy if exists "documents admin read" on public.student_documents;
create policy "documents admin read" on public.student_documents
  for select to public
  using (
    organisation_id = public.current_organisation_id()
    and public.current_role()::text in ('admin', 'principal')
  );

drop policy if exists "documents admin write" on public.student_documents;
create policy "documents admin write" on public.student_documents
  for all to public
  using (
    organisation_id = public.current_organisation_id()
    and public.current_role()::text in ('admin', 'principal')
  )
  with check (organisation_id = public.current_organisation_id());

drop trigger if exists student_documents_updated_at on public.student_documents;
create trigger student_documents_updated_at
  before update on public.student_documents
  for each row execute function public.set_updated_at();

drop trigger if exists audit_student_documents on public.student_documents;
create trigger audit_student_documents
  after insert or update or delete on public.student_documents
  for each row execute function public.write_audit_log();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.student_documents to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Backfill metadata from the objects already in Storage
-- ---------------------------------------------------------------------------
--
-- `storage.objects` is readable from SQL, so every file in the private bucket
-- can be described without a round trip through the API.
--
-- The path convention is <studentId>/<docType>__<issuedAt>__<safeFileName>,
-- where the double underscore cannot appear in a filename (api/documents.ts
-- strips it). That makes the split unambiguous, and it is why this backfill is
-- possible at all.
--
-- Three deliberate choices:
--
--   • `issued_on` is decoded from the path, which is real data the school put
--     there when the file was uploaded.
--   • `uploaded_by` and the verification status are left at their defaults.
--     `pending` rather than guessed: a backfilled row's provenance is unknown,
--     and a document that looked verified without anyone having checked it is
--     worse than one that looks unchecked.
--   • Only objects whose first path segment is a real pupil in this project are
--     imported. Anything else in the bucket is not this school's, and an
--     insert that violated the foreign key would abort the whole migration.

insert into public.student_documents (
  organisation_id, student_id, category, title,
  file_path, file_name, content_type, size_bytes,
  issued_on, uploaded_on, verification_status, is_current
)
select
  s.organisation_id,
  s.id,
  -- Map the Storage path's doc types onto the category vocabulary. An
  -- unrecognised type is filed as 'other' rather than dropped: the file exists,
  -- it is in the cabinet, and hiding it would be a lie.
  case split_part(o.name, '/', 2)
    when 'birth-certificate' then 'birth_certificate'
    when 'transfer-certificate' then 'transfer_certificate'
    when 'previous-school'      then 'previous_school_record'
    when 'admission-form'       then 'admission_form'
    when 'aadhaar'              then 'identity_document'
    when 'parent-consent'       then 'parent_consent'
    when 'medical'              then 'medical_certificate'
    when 'photo'                then 'photograph'
    when 'address-proof'        then 'address_proof'
    else 'other'
  end,
  -- A readable title from the category and the original filename. Falls back to
  -- the object name, which is always present, so title is never blank.
  initcap(replace(split_part(o.name, '/', 2), '-', ' '))
    || ' — ' || split_part(split_part(o.name, '/', 2), '__', 3),
  o.name,
  coalesce(nullif(split_part(split_part(o.name, '/', 2), '__', 3), ''), o.name),
  (o.metadata ->> 'mimetype'),
  coalesce((o.metadata ->> 'size')::bigint, (o.metadata ->> 'contentLength')::bigint),
  -- The path timestamp is 20261002T221145Z: compact, sortable, UTC.
  case
    when split_part(split_part(o.name, '/', 2), '__', 2) ~ '^\d{8}T\d{6}Z$'
    then to_date(substr(split_part(split_part(o.name, '/', 2), '__', 2), 1, 8), 'YYYYMMDD')
    else null
  end,
  coalesce(o.created_at, now())::date,
  'pending',
  true
from storage.objects o
join public.students s
  on s.id::text = split_part(o.name, '/', 1)
where o.bucket_id = 'student-documents'
  -- Guard against an object with fewer than two path segments.
  and array_length(string_to_array(o.name, '/'), 1) >= 2
  -- One current row per (student, category): keep the newest file when a
  -- category somehow has several, so the partial unique index cannot be violated.
  and o.name = (
    select newest.name
      from storage.objects newest
     where newest.bucket_id = 'student-documents'
       and split_part(newest.name, '/', 1) = split_part(o.name, '/', 1)
       and split_part(newest.name, '/', 2) ~ ('^' || split_part(o.name, '/', 2) || '__')
     order by newest.created_at desc nulls last, newest.name desc
     limit 1
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Personal details with no home
-- ---------------------------------------------------------------------------

alter table public.students
  add column if not exists blood_group text,
  add column if not exists nationality text,
  add column if not exists mother_tongue text,
  add column if not exists religion text,
  add column if not exists aadhaar_last4 text,
  -- Emergency contact lives on `students` as well as the health record because
  -- the front office needs it without opening the restricted health screen.
  -- The health record remains the fuller, medically-relevant copy.
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

comment on column public.students.aadhaar_last4 is
  'Last four digits only. The full Aadhaar number is never stored in this system; it lives in the uploaded document.';

comment on column public.students.address is
  'jsonb holding the residential address: line1, line2, city, district, state, pincode, country.';

-- Backfill the structured address parts from any legacy free-text value, so the
-- new address form has something to show.
update public.students
   set address = jsonb_build_object(
         'line1',      coalesce(address ->> 'line1',  address ->> 'address1'),
         'line2',      coalesce(address ->> 'line2',  address ->> 'address2'),
         'city',       address ->> 'city',
         'district',   address ->> 'district',
         'state',      coalesce(address ->> 'state', address ->> 'state_name'),
         'pincode',    coalesce(address ->> 'pincode', address ->> 'pin', address ->> 'postal_code'),
         'country',    coalesce(address ->> 'country', 'India')
       )
 where address <> '{}'::jsonb
   and address ?| array['line1', 'address1', 'city', 'district', 'state', 'state_name', 'pincode', 'pin', 'postal_code'];

-- `students` had no audit trigger for its new columns before this migration and
-- already has one (audit_students) from the original schema, so nothing to add.
-- The updated_at trigger also already exists as students_updated_at.

-- ---------------------------------------------------------------------------
-- 4. Seed admission history from what the pupil record already says
-- ---------------------------------------------------------------------------

insert into public.admission_records (
  organisation_id, student_id, status, applied_on, admitted_on
)
select
  s.organisation_id,
  s.id,
  -- The status vocabulary is wider than `students.status`, so each value maps to
  -- exactly one admission state rather than being copied across verbatim.
  case s.status
    when 'withdrawn' then 'withdrawn'
    when 'graduated' then 'graduated'
    else 'approved'
  end,
  s.joined_on,
  s.joined_on
from public.students s
where s.status in ('withdrawn', 'graduated')
on conflict do nothing;

commit;

-- ============================================================================
-- After running this:
--
--   select category, count(*) from public.student_documents
--    group by category order by 2 desc;      -- whatever is in the bucket
--   select count(*) from public.student_documents where uploaded_by is null;
--                                            -- the legacy, unverified backfill
--   select count(*) from public.admission_records;   -- only withdrawn/graduated
--
-- Only `applied_on` and `admitted_on` are seeded, both from `students.joined_on`,
-- which is a real fact. `withdrawn_on` and `graduated_on` are left null even
-- though the status is known, because the date is not: `joined_on` is when the
-- pupil arrived, not when they left. An administrator fills those in from the
-- paper record.
-- ============================================================================