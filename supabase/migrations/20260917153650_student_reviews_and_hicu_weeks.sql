begin;

create domain public.student_review_category as text
  check (value in ('star_student', 'on_track', 'needs_attention', 'critical'));
create domain public.student_module_state as text
  check (value in ('on_track', 'needs_attention', 'critical'));

-- One compact current review per student. An absent row means not reviewed.
create table public.student_reviews (
  student_id uuid primary key references public.students(id),
  category public.student_review_category not null,
  expected_band public.ielts_band,
  listening_state public.student_module_state,
  reading_state public.student_module_state,
  writing_state public.student_module_state,
  speaking_state public.student_module_state,
  updated_by uuid not null references public.profiles(id) default auth.uid(),
  updated_at timestamptz not null default clock_timestamp()
);

-- Weeks belong to an enrollment, so repeating HICU never overwrites earlier monitoring.
create table public.student_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id),
  week smallint not null check (week between 1 and 4),
  review_date date not null,
  category public.student_review_category not null,
  expected_band public.ielts_band,
  listening_state public.student_module_state,
  reading_state public.student_module_state,
  writing_state public.student_module_state,
  speaking_state public.student_module_state,
  condition_notes text not null default '' check (length(condition_notes) <= 10000),
  discussion text not null default '' check (length(discussion) <= 10000),
  steps_taken text not null default '' check (length(steps_taken) <= 10000),
  updated_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (enrollment_id, week)
);
create index student_reviews_author_idx on public.student_reviews(updated_by);
create index student_weekly_reviews_author_idx on public.student_weekly_reviews(updated_by);

alter table public.student_reviews enable row level security;
alter table public.student_weekly_reviews enable row level security;
create policy student_reviews_read on public.student_reviews for select to authenticated
  using (private.desk_can_student(student_id));
create policy student_weekly_reviews_read on public.student_weekly_reviews for select to authenticated
  using (exists (
    select 1 from public.enrollments e join public.batches b on b.id = e.batch_id
    where e.id = enrollment_id and private.desk_can_student(e.student_id)
  ));
-- Use the same RPC-only write pattern as the existing application.
revoke all on public.student_reviews, public.student_weekly_reviews from public, anon, authenticated;
grant select on public.student_reviews, public.student_weekly_reviews to authenticated;

create function private.desk_is_hicu(course_name text, course_code text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select regexp_replace(upper(coalesce(course_code, '')), '[^A-Z0-9]', '', 'g') in ('HICU', 'CDHICU')
    or coalesce(course_name, '') ~* '(^|[^A-Z0-9])(CD[[:space:]_-]*)?HICU($|[^A-Z0-9])'
$$;
revoke execute on function private.desk_is_hicu(text, text) from public, anon, authenticated;

create function private.desk_save_review(action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  staff_role text := private.desk_role();
  sid uuid;
  eid uuid;
  rid uuid;
  oldrow jsonb;
  savedrow jsonb;
  table_label text;
  target_week integer;
  course_name text;
  course_code text;
  enrollment_branch uuid;
  teacher uuid;
  assistant uuid;
begin
  if auth.uid() is null or staff_role is null then
    raise exception 'Your account must be activated by an administrator.';
  end if;
  if staff_role not in ('super_admin', 'branch_manager', 'academic_coordinator', 'teacher') then
    raise exception 'You cannot record academic reviews.';
  end if;
  if action is null or action not in ('save_student_review', 'save_weekly_review') then
    raise exception 'Unsupported review action.';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 150000 then
    raise exception 'Invalid review record.';
  end if;
  if jsonb_typeof(payload->'module_states') is distinct from 'object' then
    raise exception 'Module states are required.';
  end if;
  sid := (payload->>'student_id')::uuid;
  if not private.desk_can_student(sid) then
    raise exception 'This student is outside your access.';
  end if;
  -- Serialize saves, including two staff trying to create the same week at once.
  perform 1 from public.students where id = sid and deleted_at is null for update;
  if not found then raise exception 'Student not found.'; end if;

  if action = 'save_student_review' then
    select to_jsonb(r) into oldrow from public.student_reviews r where r.student_id = sid;
    if (oldrow->>'updated_at')::timestamptz is distinct from nullif(payload->>'updated_at', '')::timestamptz then
      raise exception 'Another staff member updated this review. Close this form, refresh the profile and try again.';
    end if;
    insert into public.student_reviews as r (student_id, category, expected_band, listening_state, reading_state, writing_state, speaking_state, updated_by)
    values (sid, (payload->>'category')::public.student_review_category, (payload->>'expected_band')::public.ielts_band,
      (payload->'module_states'->>'listening')::public.student_module_state,
      (payload->'module_states'->>'reading')::public.student_module_state,
      (payload->'module_states'->>'writing')::public.student_module_state,
      (payload->'module_states'->>'speaking')::public.student_module_state, auth.uid())
    on conflict (student_id) do update set category = excluded.category, expected_band = excluded.expected_band,
      listening_state = excluded.listening_state, reading_state = excluded.reading_state,
      writing_state = excluded.writing_state, speaking_state = excluded.speaking_state,
      updated_by = auth.uid(), updated_at = clock_timestamp()
    returning to_jsonb(r) into savedrow;
    rid := sid;
    table_label := 'student_reviews';
  else
    eid := (payload->>'enrollment_id')::uuid;
    target_week := (payload->>'week')::integer;
    -- Never round a fractional week to a permitted integer.
    if target_week is null or target_week not between 1 and 4 then raise exception 'Choose Week 1, 2, 3 or 4.'; end if;
    select c.name, c.short_code, b.branch_id, b.teacher_id, b.assistant_teacher_id
      into course_name, course_code, enrollment_branch, teacher, assistant
      from public.enrollments e join public.batches b on b.id = e.batch_id
      join public.course_types c on c.id = b.course_type_id
      where e.id = eid and e.student_id = sid;
    if not found then raise exception 'The enrollment does not belong to this student.'; end if;
    if staff_role = 'teacher' then
      if auth.uid() is distinct from teacher and auth.uid() is distinct from assistant then
        raise exception 'You can only review your assigned enrollments.';
      end if;
    elsif not private.desk_can_branch(enrollment_branch) then
      raise exception 'This enrollment is outside your campus access.';
    end if;
    if not private.desk_is_hicu(course_name, course_code) and not exists (
      select 1 from public.student_weekly_reviews r where r.enrollment_id = eid
    ) then
      raise exception 'Weekly monitoring is available for HICU and CD-HICU enrollments only.';
    end if;
    -- Existing monitoring stays available if an HICU course is later renamed.
    select to_jsonb(r) into oldrow from public.student_weekly_reviews r where r.enrollment_id = eid and r.week = target_week;
    if (oldrow->>'updated_at')::timestamptz is distinct from nullif(payload->>'updated_at', '')::timestamptz then
      raise exception 'Another staff member updated this week. Close this form, refresh the profile and try again.';
    end if;
    insert into public.student_weekly_reviews as r
      (enrollment_id, week, review_date, category, expected_band, listening_state, reading_state, writing_state, speaking_state, condition_notes, discussion, steps_taken, updated_by)
    values (eid, target_week, nullif(payload->>'review_date', '')::date, (payload->>'category')::public.student_review_category,
      (payload->>'expected_band')::public.ielts_band,
      (payload->'module_states'->>'listening')::public.student_module_state,
      (payload->'module_states'->>'reading')::public.student_module_state,
      (payload->'module_states'->>'writing')::public.student_module_state,
      (payload->'module_states'->>'speaking')::public.student_module_state,
      trim(coalesce(payload->>'condition_notes', '')), trim(coalesce(payload->>'discussion', '')),
      trim(coalesce(payload->>'steps_taken', '')), auth.uid())
    on conflict (enrollment_id, week) do update set review_date = excluded.review_date,
      category = excluded.category, expected_band = excluded.expected_band,
      listening_state = excluded.listening_state, reading_state = excluded.reading_state,
      writing_state = excluded.writing_state, speaking_state = excluded.speaking_state,
      condition_notes = excluded.condition_notes, discussion = excluded.discussion, steps_taken = excluded.steps_taken,
      updated_by = auth.uid(), updated_at = clock_timestamp()
    returning id, to_jsonb(r) into rid, savedrow;
    table_label := 'student_weekly_reviews';
  end if;
  insert into public.audit_logs(action, table_name, record_id, old_values, new_values)
    values (action, table_label, rid, oldrow, savedrow);
  return jsonb_build_object('id', rid, 'student_id', sid);
end
$$;

create function public.desk_save_review(action text, payload jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.desk_save_review(action, payload)
$$;
revoke execute on function private.desk_save_review(text, jsonb), public.desk_save_review(text, jsonb) from public, anon, authenticated;
grant execute on function private.desk_save_review(text, jsonb), public.desk_save_review(text, jsonb) to authenticated;

-- The snapshot definition below retains all existing fields and appends review data.

create or replace function public.desk_snapshot() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if auth.uid() is null then raise exception 'Please sign in.';end if;
 select jsonb_build_object(
 'me',(select to_jsonb(p)||jsonb_build_object('role',r.name) from public.profiles p join public.roles r on r.id=p.role_id where p.id=auth.uid()),
 'branches',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.branches b),'[]'),
 'staff',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('role',r.name) order by p.full_name) from public.profiles p join public.roles r on r.id=p.role_id),'[]'),
 'courses',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.course_types c),'[]'),
 'batches',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('start_date',coalesce(b.start_date::text,''),'end_date',coalesce(b.end_date::text,''),'start_time',coalesce(b.start_time::text,''),'end_time',coalesce(b.end_time::text,'')) order by b.created_at desc) from public.batches b),'[]'),
 'students',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object(
 'review',(select to_jsonb(r)||jsonb_build_object('module_states',jsonb_build_object('listening',r.listening_state,'reading',r.reading_state,'writing',r.writing_state,'speaking',r.speaking_state),'author_name',coalesce((select p.full_name from public.profiles p where p.id=r.updated_by),'Academic team')) from public.student_reviews r where r.student_id=s.id),
 'weekly_reviews',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('module_states',jsonb_build_object('listening',r.listening_state,'reading',r.reading_state,'writing',r.writing_state,'speaking',r.speaking_state),'author_name',coalesce((select p.full_name from public.profiles p where p.id=r.updated_by),'Academic team')) order by e.enrollment_date desc,r.week) from public.student_weekly_reviews r join public.enrollments e on e.id=r.enrollment_id where e.student_id=s.id),'[]'),
 'joining_date',coalesce(s.joining_date::text,''),
 'goal',coalesce((select to_jsonb(g) from public.student_ielts_goals g where g.student_id=s.id and g.is_current),jsonb_build_object('target_overall',null,'target_listening',null,'target_reading',null,'target_writing',null,'target_speaking',null,'destination_country','','intended_intake','','study_level','','purpose','','goal_notes','')),
 'plan',coalesce((select jsonb_build_object('registration_status',coalesce(r.registration_status,'not_planning'),'intended_exam_date',coalesce(p.intended_exam_date::text,''),'intended_exam_month',coalesce(to_char(p.intended_exam_month,'YYYY-MM'),''),'promised_registration_date',coalesce(r.promised_registration_date::text,''),'actual_registration_date',coalesce(r.actual_registration_date::text,''),'actual_exam_date',coalesce(r.actual_exam_date::text,''),'provider',p.provider,'test_centre',coalesce(r.test_centre,p.intended_test_centre),'candidate_reference',coalesce(r.candidate_reference,''),'exam_type',p.exam_type,'exam_format',p.exam_format,'notes',coalesce(r.notes,p.planning_notes)) from public.exam_plans p left join public.exam_registrations r on r.exam_plan_id=p.id where p.student_id=s.id and p.is_current),jsonb_build_object('registration_status','not_planning','intended_exam_date','','intended_exam_month','','promised_registration_date','','actual_registration_date','','actual_exam_date','','provider','','test_centre','','candidate_reference','','exam_type','IELTS Academic','exam_format','Computer','notes','')),
 'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by e.enrollment_date desc,e.created_at desc) from public.enrollments e where e.student_id=s.id),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('completion_date',coalesce(h.completion_date::text,'')) order by h.created_at desc) from public.student_course_history h where h.student_id=s.id),'[]'),
 'assessments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'student_id',a.student_id,'enrollment_id',a.enrollment_id,'levels',jsonb_build_object('listening',a.listening_level,'reading',a.reading_level,'writing',a.writing_level,'speaking',a.speaking_level),'bands',jsonb_build_object('listening',a.listening_band,'reading',a.reading_band,'writing',a.writing_band,'speaking',a.speaking_band),'observation',a.observation,'assessed_by',coalesce((select p.full_name from public.profiles p where p.id=a.assessed_by),'Academic team'),'created_at',a.created_at) order by a.created_at desc) from public.student_assessments a where a.student_id=s.id),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)||jsonb_build_object('author_name',coalesce((select p.full_name from public.profiles p where p.id=n.author_id),'Staff member')) order by n.created_at desc) from public.student_notes n where n.student_id=s.id),'[]')
 ) order by s.full_name) from public.students s where s.deleted_at is null),'[]')) into result;
 return result;
end$$;


notify pgrst, 'reload schema';
commit;
