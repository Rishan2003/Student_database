begin;

-- One daily club sheet per campus and module; additional imports add attendees.
create table public.club_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  club_date date not null,
  module text not null check (module in ('listening', 'reading', 'writing', 'speaking')),
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  unique (branch_id, club_date, module)
);
create table public.club_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.club_sessions(id),
  student_id uuid not null references public.students(id),
  enrollment_id uuid not null references public.enrollments(id),
  recorded_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  unique (session_id, student_id)
);
create index club_sessions_author_idx on public.club_sessions(created_by);
create index club_attendance_student_idx on public.club_attendance(student_id);
create index club_attendance_enrollment_idx on public.club_attendance(enrollment_id);
create index club_attendance_author_idx on public.club_attendance(recorded_by);

alter table public.club_sessions enable row level security;
alter table public.club_attendance enable row level security;
create policy club_sessions_read on public.club_sessions for select to authenticated
  using (private.desk_can_branch(branch_id));
create policy club_attendance_read on public.club_attendance for select to authenticated
  using (private.desk_can_student(student_id) and exists (
    select 1 from public.club_sessions c where c.id = session_id
  ));
revoke all on public.club_sessions, public.club_attendance from public, anon, authenticated;
grant select on public.club_sessions, public.club_attendance to authenticated;

create function private.desk_can_record_clubs(campus uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and private.desk_role() in ('super_admin', 'branch_manager', 'academic_coordinator', 'teacher', 'front_desk')
    and private.desk_can_branch(campus)
$$;
revoke execute on function private.desk_can_record_clubs(uuid) from public, anon, authenticated;

-- Clubs contain students from other teachers' batches. This purpose-specific
-- directory exposes only names, student codes and enrollments within the campus.
-- It never widens access to student profiles, contacts, goals or assessments.
create function private.desk_club_roster(campus uuid, session_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if private.desk_can_record_clubs(campus) is not true then raise exception 'You cannot import club attendance for this campus.'; end if;
  if session_date is null or session_date > (now() at time zone 'Asia/Dhaka')::date then raise exception 'Choose a club date, today or earlier.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'enrollment_id', e.id, 'student_id', s.id, 'full_name', s.full_name, 'student_code', s.student_code,
    'batch_id', b.id, 'batch_code', b.batch_code, 'course_code', c.short_code, 'course_name', c.name,
    'enrollment_date', e.enrollment_date, 'enrollment_status', e.status
  ) order by s.full_name, b.batch_code, e.enrollment_date desc)
    from public.enrollments e join public.students s on s.id = e.student_id
    join public.batches b on b.id = e.batch_id join public.course_types c on c.id = b.course_type_id
    where b.branch_id = campus and s.deleted_at is null and e.enrollment_date <= session_date), '[]');
end
$$;
create function public.desk_club_roster(campus uuid, session_date date)
returns jsonb language sql security invoker set search_path = '' as $$ select private.desk_club_roster(campus, session_date) $$;

-- Normal RLS determines which students' attendance the viewer may see.
create function public.desk_club_day(campus uuid, session_date date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if auth.uid() is null or private.desk_role() is null or not private.desk_can_branch(campus) then raise exception 'This campus is outside your access.'; end if;
  if session_date is null or session_date > (now() at time zone 'Asia/Dhaka')::date then raise exception 'Choose a club date, today or earlier.'; end if;
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'branch_id', c.branch_id, 'club_date', c.club_date, 'module', c.module) order by c.module)
      from public.club_sessions c where c.branch_id = campus and c.club_date = session_date), '[]'),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'session_id', a.session_id, 'student_id', a.student_id, 'enrollment_id', a.enrollment_id, 'created_at', a.created_at))
      from public.club_attendance a join public.club_sessions c on c.id = a.session_id
      where c.branch_id = campus and c.club_date = session_date), '[]')
  );
end
$$;

create function private.desk_club_write(action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  campus uuid;
  session_date date;
  club_module text;
  session_uuid uuid;
  requested uuid[];
  attendee_count integer;
  inserted_count integer;
  inserted_rows jsonb;
  oldrow jsonb;
  attendance_uuid uuid;
begin
  if auth.uid() is null or private.desk_role() is null then raise exception 'Your account must be activated by an administrator.'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 100000 then raise exception 'Invalid attendance import.'; end if;
  if action = 'import' then
    campus := (payload->>'branch_id')::uuid;
    session_date := (payload->>'club_date')::date;
    club_module := payload->>'module';
    if private.desk_can_record_clubs(campus) is not true then raise exception 'You cannot import club attendance for this campus.'; end if;
    if session_date is null or session_date > (now() at time zone 'Asia/Dhaka')::date then raise exception 'Choose a club date, today or earlier.'; end if;
    if club_module is null or club_module not in ('listening', 'reading', 'writing', 'speaking') then raise exception 'Choose Listening, Reading, Writing or Speaking.'; end if;
    if jsonb_typeof(payload->'enrollment_ids') is distinct from 'array' then raise exception 'Choose the students to import.'; end if;
    if jsonb_array_length(payload->'enrollment_ids') not between 1 and 300 then raise exception 'Import between 1 and 300 rows at a time.'; end if;
    select array_agg(distinct value::uuid) into requested from jsonb_array_elements_text(payload->'enrollment_ids');
    -- Validate every requested enrollment before making any change; no partial saves.
    perform e.id from public.enrollments e join public.batches b on b.id = e.batch_id
      join public.students s on s.id = e.student_id
      where e.id = any(requested) and b.branch_id = campus and s.deleted_at is null and e.enrollment_date <= session_date
      order by e.id for share of e, b, s;
    get diagnostics attendee_count = row_count;
    if attendee_count <> cardinality(requested) then raise exception 'Some students are not enrolled at this campus on that date. Recheck the matches.'; end if;
    select count(distinct e.student_id) into attendee_count from public.enrollments e where e.id = any(requested);
    insert into public.club_sessions(branch_id, club_date, module) values(campus, session_date, club_module)
      on conflict (branch_id, club_date, module) do nothing;
    -- Serializing a session also makes concurrent imports and corrections deterministic.
    select id into session_uuid from public.club_sessions where branch_id = campus and club_date = session_date and module = club_module for update;
    with inserted as (
      insert into public.club_attendance(session_id, student_id, enrollment_id)
      select session_uuid, e.student_id, e.id from (
        select distinct on (x.student_id) x.id, x.student_id
        from public.enrollments x where x.id = any(requested) order by x.student_id, x.id
      ) e on conflict (session_id, student_id) do nothing returning *
    ) select count(*), coalesce(jsonb_agg(to_jsonb(inserted)), '[]') into inserted_count, inserted_rows from inserted;
    if inserted_count > 0 then
      insert into public.audit_logs(action, table_name, record_id, new_values)
        values('import_club_attendance', 'club_attendance', session_uuid,
          jsonb_build_object('branch_id', campus, 'club_date', session_date, 'module', club_module, 'entries', inserted_rows));
    end if;
    return jsonb_build_object('session_id', session_uuid, 'added', inserted_count, 'already_recorded', attendee_count - inserted_count);
  elsif action = 'remove' then
    attendance_uuid := (payload->>'attendance_id')::uuid;
    select c.branch_id, c.id into campus, session_uuid from public.club_attendance a join public.club_sessions c on c.id = a.session_id where a.id = attendance_uuid;
    if not found then raise exception 'This attendance entry has already been removed. Refresh the view.'; end if;
    if private.desk_can_record_clubs(campus) is not true then raise exception 'You cannot correct attendance for this campus.'; end if;
    perform 1 from public.club_sessions where id = session_uuid for update;
    delete from public.club_attendance a where a.id = attendance_uuid returning to_jsonb(a) into oldrow;
    if not found then raise exception 'This attendance entry has already been removed. Refresh the view.'; end if;
    insert into public.audit_logs(action, table_name, record_id, old_values) values('remove_club_attendance', 'club_attendance', attendance_uuid, oldrow);
    return jsonb_build_object('session_id', session_uuid, 'added', 0, 'already_recorded', 0);
  else
    raise exception 'Unsupported attendance action.';
  end if;
end
$$;
create function public.desk_club_write(action text, payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$ select private.desk_club_write(action, payload) $$;

revoke execute on function private.desk_club_roster(uuid,date), public.desk_club_roster(uuid,date), public.desk_club_day(uuid,date), private.desk_club_write(text,jsonb), public.desk_club_write(text,jsonb) from public, anon, authenticated;
grant execute on function private.desk_club_roster(uuid,date), public.desk_club_roster(uuid,date), public.desk_club_day(uuid,date), private.desk_club_write(text,jsonb), public.desk_club_write(text,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
