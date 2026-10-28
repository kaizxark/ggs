/*
 * The staff overview only needs three aggregates from the attendance table:
 * the last seven school days, per-class term attendance, and the number of
 * pupils below 90%. Reading 12k rows into the browser to compute those made
 * the dashboard wait on thirteen paginated PostgREST requests.
 *
 * Keep the aggregation in Postgres, scoped to the caller's organisation, and
 * return one small JSON payload.
 */
create or replace function public.dashboard_attendance()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select organisation_id
    from public.profiles
    where id = auth.uid()
  ),
  att as (
    select a.student_id, a.classroom_id, a.attendance_date, a.status
    from public.attendance a
    join me on a.organisation_id = me.organisation_id
  ),
  daily as (
    select
      attendance_date,
      count(*) filter (where status = 'present') as present,
      count(*) filter (where status = 'absent') as absent,
      count(*) filter (where status = 'late') as late,
      count(*) filter (where status = 'leave') as leave
    from att
    group by attendance_date
    order by attendance_date desc
    limit 7
  ),
  classes as (
    select
      c.id,
      c.grade,
      c.section,
      coalesce(s.name, 'Unassigned') as teacher,
      count(a.student_id) as total,
      count(a.student_id) filter (where a.status in ('present', 'late')) as present
    from public.classrooms c
    join me on c.organisation_id = me.organisation_id
    left join public.staff s on s.id = c.class_teacher_id
    left join att a on a.classroom_id = c.id
    group by c.id, c.grade, c.section, s.name
  ),
  per_student as (
    select
      student_id,
      count(*) as total,
      count(*) filter (where status in ('present', 'late')) as present
    from att
    group by student_id
  ),
  below as (
    select count(*) as total
    from per_student
    where total > 0
      and round(present::numeric * 100 / total) < 90
  )
  select jsonb_build_object(
    'daily', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', attendance_date,
            'present', present,
            'absent', absent,
            'late', late,
            'leave', leave
          )
          order by attendance_date
        )
        from daily
      ),
      '[]'::jsonb
    ),
    'classes', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', id,
            'grade', grade,
            'section', section,
            'teacher', teacher,
            'total', total,
            'present', present
          )
          order by grade, section
        )
        from classes
      ),
      '[]'::jsonb
    ),
    'belowThreshold', (select total from below)
  );
$$;

revoke all on function public.dashboard_attendance() from public;
grant execute on function public.dashboard_attendance() to authenticated, service_role;
