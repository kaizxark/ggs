/*
 * The overview's three health figures were computed by reading the whole
 * attendance, exam_results and invoices tables into the browser. Aggregate
 * them in Postgres and return only the three percentages.
 */
create or replace function public.dashboard_health()
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
    select a.status
    from public.attendance a
    join me on a.organisation_id = me.organisation_id
  ),
  results as (
    select r.marks, r.max_marks, r.grade
    from public.exam_results r
    join me on r.organisation_id = me.organisation_id
  ),
  invoices as (
    select i.total, i.paid_amount
    from public.invoices i
    join me on i.organisation_id = me.organisation_id
  )
  select jsonb_build_object(
    'attendancePct', coalesce(
      (
        select round(
          count(*) filter (where status in ('present', 'late'))::numeric
          * 100 / nullif(count(*), 0)
        )
        from att
      ),
      0
    ),
    'academicPct', coalesce(
      (
        select round(avg(marks::numeric * 100 / nullif(max_marks, 0)))
        from results
        where grade <> 'Ab' and max_marks > 0
      ),
      0
    ),
    'feePct', coalesce(
      (
        select round(
          sum(paid_amount)::numeric * 100 / nullif(sum(total), 0)
        )
        from invoices
      ),
      0
    )
  );
$$;

revoke all on function public.dashboard_health() from public;
grant execute on function public.dashboard_health() to authenticated, service_role;
