begin;
create function public.desk_snapshot() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if auth.uid() is null then raise exception 'Please sign in.';end if;
 select jsonb_build_object(
 'me',(select to_jsonb(p)||jsonb_build_object('role',r.name) from public.profiles p join public.roles r on r.id=p.role_id where p.id=auth.uid()),
 'branches',coalesce((select jsonb_agg(to_jsonb(b) order by b.name) from public.branches b),'[]'),
 'staff',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('role',r.name) order by p.full_name) from public.profiles p join public.roles r on r.id=p.role_id),'[]'),
 'courses',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.course_types c),'[]'),
 'batches',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object('start_date',coalesce(b.start_date::text,''),'end_date',coalesce(b.end_date::text,''),'start_time',coalesce(b.start_time::text,''),'end_time',coalesce(b.end_time::text,'')) order by b.created_at desc) from public.batches b),'[]'),
 'students',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object(
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

create function private.desk_write(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 r text:=private.desk_role();sid uuid;rid uuid;bid uuid;pid uuid;oldrow jsonb;rowdata jsonb;core jsonb;batchrow public.batches%rowtype;outcome jsonb;table_label text;currstatus text;newstatus text;
begin
 if auth.uid() is null or r is null then raise exception 'Your account must be activated by an administrator.';end if;
 if r='viewer' then raise exception 'Your account has read-only access.';end if;
 if octet_length(payload::text)>150000 then raise exception 'The submitted record is too large.';end if;
 if action='create_student' then
  if r not in ('super_admin','branch_manager','academic_coordinator','front_desk') then raise exception 'You cannot create student profiles.';end if;
  core:=payload->'core';bid:=(core->>'primary_branch_id')::uuid;
  if not private.desk_can_branch(bid) then raise exception 'This campus is outside your access.';end if;
  insert into public.students(full_name,primary_phone,whatsapp_phone,secondary_phone,email,primary_branch_id,status,joining_date,education_level,institution_name,home_district,address,general_notes)
  values(trim(core->>'full_name'),core->>'primary_phone',coalesce(core->>'whatsapp_phone',''),coalesce(core->>'secondary_phone',''),coalesce(core->>'email',''),bid,coalesce(core->>'status','active'),nullif(core->>'joining_date','')::date,coalesce(core->>'education_level',''),coalesce(core->>'institution_name',''),coalesce(core->>'home_district',''),coalesce(core->>'address',''),coalesce(core->>'general_notes','')) returning id into sid;
  if nullif(payload->>'batch_id','') is not null then perform private.desk_write('add_enrollment',jsonb_build_object('student_id',sid,'batch_id',payload->>'batch_id','enrollment_date',coalesce(nullif(core->>'joining_date',''),current_date::text),'status','active'));end if;
  if payload->'history' is not null and payload->'history'<>'null'::jsonb then perform private.desk_write('add_history',payload->'history'||jsonb_build_object('student_id',sid));end if;
  if r<>'front_desk' then
   if payload->'goal' is not null then perform private.desk_write('save_goal',payload->'goal'||jsonb_build_object('student_id',sid));end if;
   if payload->'plan' is not null then perform private.desk_write('save_plan',payload->'plan'||jsonb_build_object('student_id',sid));end if;
   if payload->'assessment' is not null and payload->'assessment'<>'null'::jsonb and ((payload->'assessment'->'levels')<>'{"listening":null,"reading":null,"writing":null,"speaking":null}'::jsonb or (payload->'assessment'->'bands')<>'{"listening":null,"reading":null,"writing":null,"speaking":null}'::jsonb or coalesce(payload->'assessment'->>'observation','')<>'') then perform private.desk_write('add_assessment',payload->'assessment'||jsonb_build_object('student_id',sid));end if;
  end if;
  rid:=sid;table_label:='students';
 elsif action='update_core' then
  sid:=(payload->>'id')::uuid;
  if r not in ('super_admin','branch_manager','academic_coordinator','front_desk') or not private.desk_can_student(sid) then raise exception 'You cannot edit this student.';end if;
  select to_jsonb(s) into oldrow from public.students s where s.id=sid for update;
  if oldrow is null then raise exception 'Student not found.';end if;
  if (oldrow->>'updated_at')::timestamptz is distinct from (payload->>'updated_at')::timestamptz then raise exception 'Another staff member updated this student. Reload the profile before saving again.';end if;
  core:=payload->'core';bid:=(core->>'primary_branch_id')::uuid;
  if not private.desk_can_branch(bid) then raise exception 'The selected campus is outside your access.';end if;
  update public.students set full_name=trim(core->>'full_name'),primary_phone=core->>'primary_phone',whatsapp_phone=coalesce(core->>'whatsapp_phone',''),secondary_phone=coalesce(core->>'secondary_phone',''),email=coalesce(core->>'email',''),primary_branch_id=bid,status=core->>'status',joining_date=nullif(core->>'joining_date','')::date,education_level=coalesce(core->>'education_level',''),institution_name=coalesce(core->>'institution_name',''),home_district=coalesce(core->>'home_district',''),address=coalesce(core->>'address',''),general_notes=coalesce(core->>'general_notes','') where id=sid;
  rid:=sid;table_label:='students';
 elsif action='save_course' then
  if r<>'super_admin' then raise exception 'Only the super administrator can manage shared course types.';end if;
  rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  if length(trim(coalesce(payload->>'name','')))=0 or length(trim(coalesce(payload->>'short_code','')))=0 then raise exception 'Course name and code are required.';end if;
  select to_jsonb(c) into oldrow from public.course_types c where c.id=rid;
  insert into public.course_types(id,name,short_code,category,description,default_duration_days,is_active,ielts_tracking_enabled) values(rid,trim(payload->>'name'),upper(trim(payload->>'short_code')),coalesce(payload->>'category',''),coalesce(payload->>'description',''),(payload->>'default_duration_days')::integer,coalesce((payload->>'is_active')::boolean,true),coalesce((payload->>'ielts_tracking_enabled')::boolean,false)) on conflict(id) do update set name=excluded.name,short_code=excluded.short_code,category=excluded.category,description=excluded.description,default_duration_days=excluded.default_duration_days,is_active=excluded.is_active,ielts_tracking_enabled=excluded.ielts_tracking_enabled,updated_at=clock_timestamp();table_label:='course_types';
 elsif action='save_batch' then
  if r not in ('super_admin','academic_coordinator','branch_manager') then raise exception 'You cannot manage batches.';end if;
  bid:=(payload->>'branch_id')::uuid;rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
  select to_jsonb(b) into oldrow from public.batches b where b.id=rid;
  if not private.desk_can_branch(bid) or oldrow is not null and not private.desk_can_branch((oldrow->>'branch_id')::uuid) then raise exception 'This batch is outside your campus access.';end if;
  if oldrow is not null and (oldrow->>'course_type_id')::uuid<>(payload->>'course_type_id')::uuid and exists(select 1 from public.enrollments e where e.batch_id=rid) then raise exception 'This batch has enrollments. Create a new batch to change its course.';end if;
  if oldrow is not null and (oldrow->>'branch_id')::uuid<>bid and exists(select 1 from public.enrollments e where e.batch_id=rid) then raise exception 'This batch has enrollments. Create a new batch to change its campus.';end if;
  if trim(coalesce(payload->>'batch_code',''))='' then raise exception 'Batch code is required.';end if;
  if (payload->>'maximum_capacity')::integer < (select count(*) from public.enrollments e where e.batch_id=rid and e.status in ('active','enrolled')) then raise exception 'Capacity cannot be below the current enrollment count.';end if;
  if nullif(payload->>'teacher_id','') is not null and not exists(select 1 from public.profiles p where p.id=(payload->>'teacher_id')::uuid and p.is_active and (p.branch_id=bid or exists(select 1 from public.user_branch_access a where a.user_id=p.id and a.branch_id=bid) or exists(select 1 from public.roles rr where rr.id=p.role_id and rr.name='super_admin'))) then raise exception 'The teacher must have access to this campus.';end if;
  insert into public.batches(id,course_type_id,branch_id,batch_code,name,teacher_id,start_date,end_date,class_days,start_time,end_time,room,maximum_capacity,status,notes) values(rid,(payload->>'course_type_id')::uuid,bid,trim(payload->>'batch_code'),coalesce(payload->>'name',''),nullif(payload->>'teacher_id','')::uuid,nullif(payload->>'start_date','')::date,nullif(payload->>'end_date','')::date,coalesce(payload->'class_days','[]'),nullif(payload->>'start_time','')::time,nullif(payload->>'end_time','')::time,coalesce(payload->>'room',''),(payload->>'maximum_capacity')::integer,coalesce(payload->>'status','planned'),coalesce(payload->>'notes','')) on conflict(id) do update set course_type_id=excluded.course_type_id,branch_id=excluded.branch_id,batch_code=excluded.batch_code,name=excluded.name,teacher_id=excluded.teacher_id,start_date=excluded.start_date,end_date=excluded.end_date,class_days=excluded.class_days,start_time=excluded.start_time,end_time=excluded.end_time,room=excluded.room,maximum_capacity=excluded.maximum_capacity,status=excluded.status,notes=excluded.notes,updated_at=clock_timestamp();table_label:='batches';
 elsif action in ('add_enrollment','update_enrollment') then
  sid:=(payload->>'student_id')::uuid;
  if r not in ('super_admin','academic_coordinator','branch_manager','front_desk') or not private.desk_can_student(sid) then raise exception 'You cannot enroll this student.';end if;
  if action='add_enrollment' then bid:=(payload->>'batch_id')::uuid;else select to_jsonb(e),e.batch_id into oldrow,bid from public.enrollments e where e.id=(payload->>'id')::uuid and e.student_id=sid for update;if oldrow is null then raise exception 'Enrollment not found.';end if;end if;
  select * into batchrow from public.batches where id=bid for update;
  if batchrow.id is null or not private.desk_can_branch(batchrow.branch_id) then raise exception 'This batch is outside your access.';end if;
  newstatus:=coalesce(payload->>'status','active');
  if newstatus in ('active','enrolled') then
   if batchrow.status not in ('planned','open','running') then raise exception 'This batch is closed to enrollment.';end if;
   if batchrow.maximum_capacity is not null and (select count(*) from public.enrollments e where e.batch_id=bid and e.status in ('active','enrolled') and (action='add_enrollment' or e.id<>(payload->>'id')::uuid))>=batchrow.maximum_capacity then raise exception 'This batch is at capacity.';end if;
  end if;
  if action='add_enrollment' then insert into public.enrollments(student_id,batch_id,enrollment_date,status,enrollment_notes,previous_hexus_student) values(sid,bid,coalesce(nullif(payload->>'enrollment_date','')::date,current_date),newstatus,coalesce(payload->>'enrollment_notes',''),exists(select 1 from public.enrollments e where e.student_id=sid) or exists(select 1 from public.student_course_history h where h.student_id=sid and h.institution_type='hexas')) returning id into rid;else rid:=(payload->>'id')::uuid;update public.enrollments set status=newstatus,updated_at=clock_timestamp() where id=rid;end if;table_label:='enrollments';
 elsif action='save_branch' then
  if r<>'super_admin' then raise exception 'Only the super administrator can create campuses.';end if;
  if trim(coalesce(payload->>'name',''))='' or coalesce(payload->>'code','') !~ '^[A-Za-z0-9_-]{1,12}$' then raise exception 'Enter a campus name and a code of 1–12 letters or numbers.';end if;
  insert into public.branches(name,code) values(trim(payload->>'name'),upper(trim(payload->>'code'))) returning id into rid;table_label:='branches';
 elsif action='save_staff' then
  if r<>'super_admin' then raise exception 'Only the super administrator can change staff access.';end if;
  rid:=(payload->>'id')::uuid;
  if rid=auth.uid() and (payload->>'role'<>'super_admin' or not (payload->>'is_active')::boolean) then raise exception 'You cannot remove your own administrator access.';end if;
  select to_jsonb(p) into oldrow from public.profiles p where p.id=rid for update;
  if oldrow is null then raise exception 'Staff member not found.';end if;
  select id into pid from public.roles where name=payload->>'role';if pid is null then raise exception 'Invalid staff role.';end if;
  update public.profiles set role_id=pid,branch_id=nullif(payload->>'branch_id','')::uuid,is_active=(payload->>'is_active')::boolean,updated_at=clock_timestamp() where id=rid;table_label:='profiles';
 else
  sid:=(payload->>'student_id')::uuid;
  if not private.desk_can_student(sid) then raise exception 'This student is outside your access.';end if;
  -- Serializes current goals/plans per student so two staff cannot create two current records.
  perform 1 from public.students where id=sid for update;
  if action='save_goal' then
   if r not in ('super_admin','branch_manager','academic_coordinator','counselor') then raise exception 'You cannot edit IELTS goals.';end if;
   select to_jsonb(g) into oldrow from public.student_ielts_goals g where g.student_id=sid and g.is_current;
   update public.student_ielts_goals set is_current=false,updated_at=clock_timestamp() where student_id=sid and is_current;
   insert into public.student_ielts_goals(student_id,target_overall,target_listening,target_reading,target_writing,target_speaking,destination_country,intended_intake,study_level,purpose,goal_notes) values(sid,(payload->>'target_overall')::public.ielts_band,(payload->>'target_listening')::public.ielts_band,(payload->>'target_reading')::public.ielts_band,(payload->>'target_writing')::public.ielts_band,(payload->>'target_speaking')::public.ielts_band,coalesce(payload->>'destination_country',''),coalesce(payload->>'intended_intake',''),coalesce(payload->>'study_level',''),coalesce(payload->>'purpose',''),coalesce(payload->>'goal_notes','')) returning id into rid;table_label:='student_ielts_goals';
  elsif action='save_plan' then
   if r not in ('super_admin','branch_manager','academic_coordinator','counselor') then raise exception 'You cannot update IELTS registration.';end if;
   select to_jsonb(p) into oldrow from public.exam_plans p where p.student_id=sid and p.is_current;
   update public.exam_plans set is_current=false,updated_at=clock_timestamp() where student_id=sid and is_current;
   currstatus:=coalesce(payload->>'registration_status','not_planning');
   insert into public.exam_plans(student_id,status,intended_exam_date,intended_exam_month,exam_type,exam_format,provider,intended_test_centre,planning_notes) values(sid,case currstatus when 'registered' then 'registered' when 'promised' then 'promised_registration' when 'planning' then 'planning' else 'no_plan' end,nullif(payload->>'intended_exam_date','')::date,case when coalesce(payload->>'intended_exam_month','')<>'' then (payload->>'intended_exam_month'||'-01')::date else null end,coalesce(payload->>'exam_type','IELTS Academic'),coalesce(payload->>'exam_format','Computer'),coalesce(payload->>'provider',''),coalesce(payload->>'test_centre',''),coalesce(payload->>'notes','')) returning id into pid;
   insert into public.exam_registrations(exam_plan_id,student_id,registration_status,promised_registration_date,actual_registration_date,actual_exam_date,provider,test_centre,candidate_reference,notes) values(pid,sid,currstatus,nullif(payload->>'promised_registration_date','')::date,nullif(payload->>'actual_registration_date','')::date,nullif(payload->>'actual_exam_date','')::date,coalesce(payload->>'provider',''),coalesce(payload->>'test_centre',''),coalesce(payload->>'candidate_reference',''),coalesce(payload->>'notes','')) returning id into rid;table_label:='exam_registrations';
  elsif action='add_history' then
   if r not in ('super_admin','branch_manager','academic_coordinator','front_desk') then raise exception 'You cannot add previous course history.';end if;
   insert into public.student_course_history(student_id,institution_type,institution_name,course_name,batch_name,completion_date,notes) values(sid,payload->>'institution_type',trim(payload->>'institution_name'),trim(payload->>'course_name'),coalesce(payload->>'batch_name',''),nullif(payload->>'completion_date','')::date,coalesce(payload->>'notes','')) returning id into rid;table_label:='student_course_history';
  elsif action='add_assessment' then
   if r not in ('super_admin','branch_manager','academic_coordinator','teacher') then raise exception 'You cannot record academic assessments.';end if;
   pid:=nullif(payload->>'enrollment_id','')::uuid;
   if pid is not null and not exists(select 1 from public.enrollments e where e.id=pid and e.student_id=sid) then raise exception 'The enrollment does not belong to this student.';end if;
   if r='teacher' and pid is not null and not exists(select 1 from public.enrollments e join public.batches b on b.id=e.batch_id where e.id=pid and (b.teacher_id=auth.uid() or b.assistant_teacher_id=auth.uid())) then raise exception 'You can only assess your assigned enrollments.';end if;
   insert into public.student_assessments(student_id,enrollment_id,listening_level,reading_level,writing_level,speaking_level,listening_band,reading_band,writing_band,speaking_band,observation) values(sid,pid,(payload->'levels'->>'listening')::public.module_level,(payload->'levels'->>'reading')::public.module_level,(payload->'levels'->>'writing')::public.module_level,(payload->'levels'->>'speaking')::public.module_level,(payload->'bands'->>'listening')::public.ielts_band,(payload->'bands'->>'reading')::public.ielts_band,(payload->'bands'->>'writing')::public.ielts_band,(payload->'bands'->>'speaking')::public.ielts_band,coalesce(payload->>'observation','')) returning id into rid;table_label:='student_assessments';
  elsif action='add_note' then
   if r='teacher' and coalesce(payload->>'category','general') not in ('academic','general') then raise exception 'Teachers can add academic or general notes.';end if;
   if r='front_desk' and coalesce(payload->>'category','general')<>'general' then raise exception 'Front desk staff can add general notes.';end if;
   if r='counselor' and coalesce(payload->>'category','general') not in ('counseling','exam','general') then raise exception 'Counselors can add counseling, exam or general notes.';end if;
   if coalesce(payload->>'visibility','normal')='management_only' and r not in ('super_admin','branch_manager') then raise exception 'Only managers can add management-only notes.';end if;
   insert into public.student_notes(student_id,category,note,visibility) values(sid,coalesce(payload->>'category','general'),trim(payload->>'note'),coalesce(payload->>'visibility','normal')) returning id into rid;table_label:='student_notes';
  else raise exception 'Unsupported action.';end if;
 end if;
 -- Values are parameters; no caller-controlled SQL identifiers or executable expressions.
 insert into public.audit_logs(action,table_name,record_id,old_values,new_values) values(action,table_label,rid,oldrow,payload);
 return jsonb_build_object('id',rid,'student_id',sid);
exception when unique_violation then raise exception 'This code or active enrollment already exists. Use the existing record.';
end$$;
create function public.desk_write(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.desk_write(action,payload)$$;
revoke execute on function public.desk_write(text,jsonb) from public,anon,authenticated;
grant execute on function public.desk_write(text,jsonb) to authenticated;
revoke execute on function private.desk_role(),private.desk_can_branch(uuid),private.desk_can_student(uuid),private.desk_phone(text),private.desk_student_before_write(),private.desk_profile_on_signup(),public.desk_snapshot(),private.desk_write(text,jsonb) from public,anon,authenticated;
grant execute on function private.desk_role(),private.desk_can_branch(uuid),private.desk_can_student(uuid),public.desk_snapshot(),private.desk_write(text,jsonb) to authenticated;
commit;
