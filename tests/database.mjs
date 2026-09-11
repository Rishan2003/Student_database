import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
const q=(sql,args=[])=>db.query(sql,args);
await db.exec(`create schema auth;create role anon nologin;create role authenticated nologin;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
for(const path of ['202609110001_student_desk.sql','202609110002_student_desk_rpc.sql']){
 // PGlite has gen_random_uuid built in; Supabase's pgcrypto extension is not needed in this test runtime.
 const sql=(await readFile('supabase/migrations/'+path,'utf8')).replace('create extension if not exists pgcrypto;','');
 try{await db.exec(sql)}catch(e){console.error('Migration failed',path,e.message,e.cause||'');process.exit(1)}
}
const ids={admin:'00000000-0000-4000-8000-000000000001',viewer:'00000000-0000-4000-8000-000000000002',teacher:'00000000-0000-4000-8000-000000000003',counselor:'00000000-0000-4000-8000-000000000004',front:'00000000-0000-4000-8000-000000000005',pending:'00000000-0000-4000-8000-000000000006'};
for(const [name,id] of Object.entries(ids))await q(`insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)`,[id,name+'@example.test',{full_name:name,role:'super_admin',is_active:true}]);
assert.equal((await q('select is_active from public.profiles where id=$1',[ids.pending])).rows[0].is_active,false);checks++;
const [a,b]=(await q("insert into public.branches(name,code)values('Test A','TA'),('Test B','TB')returning id")).rows.map(r=>r.id);
for(const [name,role]of [['admin','super_admin'],['viewer','viewer'],['teacher','teacher'],['counselor','counselor'],['front','front_desk']])await q('update public.profiles set role_id=(select id from public.roles where name=$1),branch_id=$2,is_active=true where id=$3',[role,a,ids[name]]);
async function as(name){await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]||'']);await db.exec(name==='anon'?'set role anon':'set role authenticated');}
async function write(action,payload){return (await q('select public.desk_write($1,$2) result',[action,payload])).rows[0].result;}
async function snap(){return(await q('select public.desk_snapshot() result')).rows[0].result;}
async function rejects(fn,pattern){await assert.rejects(fn,pattern);checks++;}
await as('anon');await rejects(()=>snap(),/permission denied/);
await as('admin');
const course=(await write('save_course',{name:'IELTS Premium',short_code:'IP',default_duration_days:90})).id;
const batch=(await write('save_batch',{course_type_id:course,branch_id:a,batch_code:'IP-TEST',teacher_id:ids.teacher,status:'running',maximum_capacity:3})).id;
const batch2=(await write('save_batch',{course_type_id:course,branch_id:a,batch_code:'IP-SECOND',status:'running',maximum_capacity:1})).id;
const core=(name,phone,branch=a)=>({full_name:name,primary_phone:phone,primary_branch_id:branch,status:'active',joining_date:'2026-09-11'});
const student=(await write('create_student',{core:core('Test Student','01711111111'),batch_id:batch,goal:{target_overall:7,destination_country:'Canada',intended_intake:'2027-09'},plan:{registration_status:'promised',promised_registration_date:'2026-09-01'},assessment:{levels:{listening:3,reading:3,writing:2,speaking:4},bands:{listening:6.5},observation:'বাংলা পর্যবেক্ষণ'}})).id;
const second=(await write('create_student',{core:core('Other Branch','01722222222',b)})).id;
let s=(await snap()).students.find(s=>s.id===student);assert.equal(s.primary_phone,'+8801711111111');assert.equal(s.assessments[0].levels.writing,2);assert.equal(s.enrollments.length,1);checks+=3;
await rejects(()=>write('create_student',{core:core('Duplicate','+8801711111111')}),/already exists/);
await rejects(()=>write('create_student',{core:{...core('Cross field duplicate','01733333333'),secondary_phone:'008801711111111'}}),/already exists/);
await rejects(()=>write('create_student',{core:core('Bad band','01733333333'),goal:{target_overall:7.3}}),/violates check constraint/);
assert.equal((await snap()).students.length,2);checks++;
await rejects(()=>write('save_plan',{student_id:student,registration_status:'registered'}),/violates check constraint/);
assert.equal((await snap()).students.find(s=>s.id===student).plan.registration_status,'promised');checks++;
await write('save_goal',{student_id:student,target_overall:7.5});
await write('add_enrollment',{student_id:student,batch_id:batch2,status:'active'});
assert.equal((await snap()).students.find(s=>s.id===student).enrollments.length,2);checks++;
await rejects(()=>write('add_enrollment',{student_id:student,batch_id:batch2,status:'active'}),/capacity|already exists/);
await rejects(()=>write('save_batch',{id:batch,course_type_id:course,branch_id:b,batch_code:'IP-TEST',status:'running',maximum_capacity:3}),/Create a new batch/);
await as('viewer');assert.equal((await snap()).students.length,1);checks++;
await rejects(()=>write('add_note',{student_id:student,note:'no'}),/read-only/);
await rejects(()=>q("insert into public.student_notes(student_id,note) values($1,'bypass')",[student]),/permission denied/);
await rejects(()=>q("update public.profiles set is_active=true,role_id=(select id from public.roles where name='super_admin') where id=$1",[ids.viewer]),/permission denied/);
await as('teacher');assert.equal((await snap()).students.length,1);checks++;
await write('add_assessment',{student_id:student,enrollment_id:s.enrollments[0].id,levels:{writing:3},bands:{},observation:'Updated'});
await rejects(()=>write('save_goal',{student_id:student,target_overall:8}),/cannot edit/);
await rejects(()=>write('add_assessment',{student_id:second,levels:{writing:3},bands:{}}),/outside your access/);
await rejects(()=>write('save_staff',{id:ids.teacher,role:'super_admin',is_active:true}),/Only the super/);
await as('counselor');await write('save_plan',{student_id:student,registration_status:'registered',actual_registration_date:'2026-09-11',actual_exam_date:'2026-10-01'});
await rejects(()=>write('add_assessment',{student_id:student,levels:{writing:5},bands:{}}),/cannot record/);
await as('front');await write('add_note',{student_id:student,category:'general',note:'Contact updated'});await rejects(()=>write('save_goal',{student_id:student,target_overall:8}),/cannot edit/);
await as('pending');assert.equal((await snap()).students.length,0);checks++;await rejects(()=>write('save_course',{name:'Forbidden',short_code:'BAD'}),/activated/);
await as('admin');s=(await snap()).students.find(s=>s.id===student);await write('update_core',{id:student,core:{...s,full_name:'Updated Student'},updated_at:s.updated_at});await rejects(()=>write('update_core',{id:student,core:{...s,full_name:'Stale update'},updated_at:s.updated_at}),/Another staff/);
await rejects(()=>write('save_staff',{id:ids.admin,role:'viewer',is_active:true}),/own administrator/);
await db.exec('reset role');
assert.equal((await q('select count(*)::integer n from public.student_ielts_goals where student_id=$1',[student])).rows[0].n,2);checks++;
assert.equal((await q('select count(*)::integer n from public.exam_plans where student_id=$1',[student])).rows[0].n,2);checks++;
assert.equal((await q('select count(*)::integer n from public.student_assessments where student_id=$1',[student])).rows[0].n,2);checks++;
assert.ok((await q('select count(*)::integer n from public.audit_logs')).rows[0].n>10);checks++;
console.log(`PASS: ${checks} database checks, including RLS, branch isolation, role restrictions, atomic rollback, history preservation, duplicate contacts, capacity and stale edits.`);
await db.close();
