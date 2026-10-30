-- ============================================================================
-- Staff sign in with their USN
--
-- `staff.usn` is the identifier the school prints on the record (STF1001) and
-- the only name a member of staff should have to remember. Older accounts were
-- created before the staff USN existed and still carry names such as
-- `emp2021038`, so the profile and credential rows disagreed with the record.
--
-- This makes the sign-in name match the record. It is intentionally an update
-- rather than a new source of truth: `staff.usn` remains the one place a staff
-- identifier is stored.
-- ============================================================================

update public.profiles p
set username = lower(regexp_replace(s.usn, '[^A-Za-z0-9]', '', 'g'))
from public.staff s
where p.id = s.profile_id
  and p.organisation_id = s.organisation_id
  and s.usn is not null
  and lower(regexp_replace(s.usn, '[^A-Za-z0-9]', '', 'g')) <> '';

update public.staff_credentials c
set username = lower(regexp_replace(s.usn, '[^A-Za-z0-9]', '', 'g'))
from public.staff s
where c.staff_id = s.id
  and c.organisation_id = s.organisation_id
  and s.usn is not null
  and lower(regexp_replace(s.usn, '[^A-Za-z0-9]', '', 'g')) <> '';
