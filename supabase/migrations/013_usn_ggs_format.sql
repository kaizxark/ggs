-- ============================================================================
-- 013 — The USN becomes GGS####
--
-- The school prints its student numbers as its initials and four digits:
-- GGS1001. The old form carried the academic year (adm26270001), which made
-- the number longer than a child could copy off a slip and restarted with
-- every intake.
--
-- The USN is also the sign-in name, so the rename has to reach the two places
-- that hold it: `profiles.username` and `student_credentials.username`. It is
-- written there in lower case, because that is the shape a username has
-- everywhere else in the product, and the sign-in route compares without case.
--
-- Only rows still on the old `adm########` form are touched, and numbering
-- starts after the highest GGS number already in use, so re-running this
-- migration on a database that has already been renumbered — or that has
-- enrolled pupils since — changes nothing and steals no number.
-- ============================================================================

begin;

create temporary table usn_renumber on commit drop as
with base as (
  select coalesce(
           max((regexp_replace(usn, '[^0-9]', '', 'g'))::int),
           1000
         ) as start
    from public.students
   where usn ~* '^GGS[0-9]+$'
)
select s.id,
       s.usn as old_usn,
       'GGS' || lpad(
         (base.start + row_number() over (order by lower(s.usn)))::text, 4, '0'
       ) as new_usn
  from public.students s
 cross join base
 where s.usn ~* '^adm[0-9]+$';

update public.students s
   set usn = r.new_usn
  from usn_renumber r
 where s.id = r.id;

-- The pupil's sign-in name, where it is still the USN it was issued with. A
-- pupil who chose a name of their own keeps it: that name is theirs and is not
-- an artefact of the numbering scheme.
update public.profiles p
   set username = lower(r.new_usn)
  from usn_renumber r
 where p.student_id = r.id
   and lower(p.username) = lower(r.old_usn);

update public.student_credentials c
   set username = lower(r.new_usn)
  from usn_renumber r
 where c.student_id = r.id
   and lower(c.username) = lower(r.old_usn);

commit;
