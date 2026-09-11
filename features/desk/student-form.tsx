'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, UserRound, Target, GraduationCap, CalendarDays, Save, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Field, Area, Pick, Band } from './fields';
import { Core, Snapshot, Student, coreSchema, goalSchema, planSchema, emptyCore, emptyGoal, emptyPlan, emptyLevels, MODULES, display, levelNames, duplicates, canIelts, canAcademic, registrationNames } from './model';
export type Mutate = (action: string, payload: unknown) => Promise<void>;
export function StudentForm({ data, student, initialBatchId, onBack, onOpen, mutate }: {
    data: Snapshot;
    student?: Student;
    initialBatchId?: string;
    onBack: () => void;
    onOpen: (s: Student) => void;
    mutate: Mutate;
}) {
    const [tab, setTab] = useState('personal'), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [goal, setGoal] = useState(student?.goal || { ...emptyGoal }), [plan, setPlan] = useState(student?.plan || { ...emptyPlan });
    const [levels, setLevels] = useState({ ...emptyLevels }), [bands, setBands] = useState({ ...emptyLevels }), [observation, setObservation] = useState('');
    const [historyType, setHistoryType] = useState('none'), [historyInstitute, setHistoryInstitute] = useState(''), [historyCourse, setHistoryCourse] = useState('');
    const initialBatch = !student ? data.batches.find(b => b.id === initialBatchId) : undefined;
    const initialCourse = initialBatch ? data.courses.find(c => c.id === initialBatch.course_type_id) : undefined;
    const initialBranch = initialBatch ? data.branches.find(b => b.id === initialBatch.branch_id) : undefined;
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Core>({ resolver: zodResolver(coreSchema), defaultValues: student || emptyCore(initialBatch?.branch_id || data.branches[0]?.id) });
    const values = watch();
    const matches = duplicates(values, data.students, student?.id);
    const ielts = canIelts(data.me?.role), academic = canAcademic(data.me?.role);
    async function submit(core: Core) {
        setError('');
        try {
            if (matches.length)
                throw new Error('A matching student already exists. Open that profile to add another enrollment.');
            if (!student && !initialBatch) {
                setTab('courses');
                throw new Error('Create or choose a batch before registering a student.');
            }
            if (!student && ielts) {
                const gv = goalSchema.safeParse(goal);
                if (!gv.success) {
                    setTab('ielts');
                    throw new Error(gv.error.issues.map(i => i.message).join(' '));
                }
                const pv = planSchema.safeParse(plan);
                if (!pv.success) {
                    setTab('ielts');
                    throw new Error(pv.error.issues.map(i => i.message).join(' '));
                }
            }
            if (!student && historyType !== 'none' && (!historyInstitute.trim() || !historyCourse.trim()))
                throw new Error('Enter the previous institution and course name.');
            setBusy(true);
            await mutate(student ? 'update_core' : 'create_student', student ? { id: student.id, core, updated_at: student.updated_at } : { core, goal: ielts ? goal : emptyGoal, plan: ielts ? plan : emptyPlan, batch_id: initialBatch!.id, assessment: academic ? { levels, bands, observation } : null, history: historyType === 'none' ? null : { institution_type: historyType, institution_name: historyInstitute, course_name: historyCourse } });
            onBack();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'The student could not be saved.');
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="editor-page"><Button variant="ghost" onClick={onBack} className="back-button"><ArrowLeft size={16}/> {student ? 'Back to student' : 'Back to batches'}</Button><div className="page-heading"><div><p className="eyebrow">STUDENT PROFILE</p><h1>{student ? 'Edit student' : `Add a student to ${initialBatch?.batch_code || 'a batch'}`}</h1><p>{student ? student.student_code : `${initialCourse?.name || 'Course'} · ${initialBranch?.name || 'Campus'}`}</p></div></div>
 <form onSubmit={handleSubmit(submit, () => { setTab('personal'); setError('Check the highlighted personal details.'); })}>
 <Tabs value={tab} onValueChange={setTab}><TabsList className="form-tabs" variant="line"><TabsTrigger value="personal"><UserRound /> Personal details</TabsTrigger>{!student && <><TabsTrigger value="courses"><GraduationCap /> Course & history</TabsTrigger>{academic && <TabsTrigger value="academic"><Target /> Module levels</TabsTrigger>}{ielts && <TabsTrigger value="ielts"><CalendarDays /> IELTS plans</TabsTrigger>}</>}</TabsList>
 <TabsContent value="personal"><section className="form-card"><h2>Personal details</h2><div className="form-grid"><div className="field"><label htmlFor="full-name">Full name <span className="required">*</span></label><Input id="full-name" {...register('full_name')} placeholder="Student’s full name" autoComplete="name"/>{errors.full_name && <p className="field-error">{errors.full_name.message}</p>}</div><div className="field"><label htmlFor="primary-phone">Phone number <span className="required">*</span></label><Input id="primary-phone" {...register('primary_phone')} placeholder="01XXXXXXXXX" type="tel"/>{errors.primary_phone && <p className="field-error">{errors.primary_phone.message}</p>}</div>
 <Field label="WhatsApp number" value={values.whatsapp_phone} onChange={v => setValue('whatsapp_phone', v)} type="tel"/><Field label="Secondary phone" value={values.secondary_phone} onChange={v => setValue('secondary_phone', v)} type="tel"/><Field label="Email" value={values.email} onChange={v => setValue('email', v)} type="email"/><Pick label="Campus" value={values.primary_branch_id} onChange={v => setValue('primary_branch_id', v)} disabled={!student && !!initialBatch} options={data.branches.filter(b => b.is_active).map(b => ({ value: b.id, label: b.name }))}/><Pick label="Student status" value={values.status} onChange={v => setValue('status', v as Core['status'])} options={['active', 'inactive', 'completed', 'dropped', 'on_hold'].map(v => ({ value: v, label: display(v) }))}/><Field label="Joining date" type="date" value={values.joining_date} onChange={v => setValue('joining_date', v)}/><Field label="Education level" value={values.education_level} onChange={v => setValue('education_level', v)} placeholder="e.g. HSC, Bachelor’s"/><Field label="School / college / university" value={values.institution_name} onChange={v => setValue('institution_name', v)}/><Field label="Home district" value={values.home_district} onChange={v => setValue('home_district', v)}/><Field label="Address" value={values.address} onChange={v => setValue('address', v)}/><Area label="General notes" value={values.general_notes} onChange={v => setValue('general_notes', v)}/></div></section>
 {matches.length > 0 && <div className="duplicate-alert" role="alert"><TriangleAlert /><div><strong>Possible existing student</strong><p>A phone number or email matches {matches.length} existing profile(s).</p>{matches.map(s => <button type="button" key={s.id} onClick={() => onOpen(s)}>{s.full_name} · {s.student_code} · Open profile →</button>)}</div></div>}</TabsContent>
 {!student && <><TabsContent value="courses"><section className="form-card"><h2>Registering in this batch</h2>{initialBatch ? <div className="enrollment-row"><div className="course-symbol"><GraduationCap /></div><div className="grow"><strong>{initialCourse?.name || 'Course'}</strong><p>{initialBatch.batch_code}{initialBatch.name ? ` · ${initialBatch.name}` : ''}</p><p>{initialBranch?.name || 'Campus'} · {initialBatch.class_days.map(d => d.slice(0, 3)).join(' · ') || 'Schedule not set'}</p></div><span className={'status-badge ' + initialBatch.status}>{display(initialBatch.status)}</span></div> : <p className="error-banner">Choose a batch before registering a student.</p>}<p className="help">The joining date will be used as the initial enrollment date. More courses can be added later from the student profile.</p></section><section className="form-card"><h2>Previous learning</h2><div className="form-grid"><Pick label="Previous course history" value={historyType} onChange={setHistoryType} options={[{ value: 'none', label: 'No previous course recorded' }, { value: 'hexas', label: 'Studied at HEXA’S' }, { value: 'external', label: 'Studied at another institute' }]}/>{historyType !== 'none' && <><Field label={historyType === 'hexas' ? 'HEXA’S campus' : 'Previous institute'} value={historyInstitute} onChange={setHistoryInstitute}/><Field label="Previous course" value={historyCourse} onChange={setHistoryCourse}/></>}</div><p className="help">Additional courses and institutions can be added from the student profile.</p></section></TabsContent>
 <TabsContent value="academic"><section className="form-card"><h2>Module-wise level</h2><p className="help">Staff assessment on a 1–5 scale. Estimated IELTS bands are recorded separately.</p><div className="form-grid">{MODULES.map(m => <Pick key={m} label={display(m) + ' level'} value={levels[m] == null ? '' : String(levels[m])} onChange={v => setLevels({ ...levels, [m]: v ? +v : null })} options={levelNames.map((l, i) => ({ value: i ? String(i) : '', label: l }))}/>)}</div></section><section className="form-card"><h2>Estimated IELTS bands</h2><div className="form-grid">{MODULES.map(m => <Band key={m} label={display(m)} value={bands[m]} onChange={v => setBands({ ...bands, [m]: v })}/>)}<Area label="Teacher’s observation" value={observation} onChange={setObservation} placeholder="Strengths, areas for improvement and recommended next steps…"/></div></section></TabsContent>
 <TabsContent value="ielts"><GoalFields value={goal} onChange={setGoal}/><PlanFields value={plan} onChange={setPlan}/></TabsContent></>}
 </Tabs>{error && <div className="error-banner" role="alert"><p>{error}</p>{Object.entries(errors).map(([field, e]) => <p key={field}>{display(field)}: {e?.message}</p>)}</div>}<div className="form-actions"><Button type="button" variant="outline" onClick={onBack}>Cancel</Button><Button type="submit" disabled={busy || matches.length > 0}><Save size={16}/>{busy ? 'Saving…' : student ? 'Save changes' : 'Create student'}</Button></div></form></div>;
}
export function GoalFields({ value: g, onChange }: {
    value: Student['goal'];
    onChange: (v: Student['goal']) => void;
}) { return <section className="form-card"><h2>Goals & destination</h2><div className="form-grid"><Band label="Target overall band" value={g.target_overall} onChange={v => onChange({ ...g, target_overall: v })}/><Field label="Destination country" value={g.destination_country} onChange={v => onChange({ ...g, destination_country: v })} placeholder="e.g. United Kingdom"/><Field label="Target intake" type="month" value={g.intended_intake} onChange={v => onChange({ ...g, intended_intake: v })}/><Field label="Study level" value={g.study_level} onChange={v => onChange({ ...g, study_level: v })} placeholder="e.g. Bachelor’s, Master’s"/>{MODULES.map(m => <Band key={m} label={'Target ' + display(m)} value={g[`target_${m}`]} onChange={v => onChange({ ...g, [`target_${m}`]: v })}/>)}<Field label="Purpose" value={g.purpose} onChange={v => onChange({ ...g, purpose: v })} placeholder="e.g. Higher education"/><Area label="Goal notes" value={g.goal_notes} onChange={v => onChange({ ...g, goal_notes: v })}/></div></section>; }
export function PlanFields({ value: p, onChange }: {
    value: Student['plan'];
    onChange: (v: Student['plan']) => void;
}) { return <section className="form-card"><h2>Exam & registration</h2><div className="form-grid"><Pick label="Registration status" value={p.registration_status} onChange={v => onChange({ ...p, registration_status: v as Student['plan']['registration_status'] })} options={Object.entries(registrationNames).map(([value, label]) => ({ value, label }))}/><Field label="Intended exam date" type="date" value={p.intended_exam_date} onChange={v => onChange({ ...p, intended_exam_date: v })}/><Field label="Intended exam month (if date unknown)" type="month" value={p.intended_exam_month} onChange={v => onChange({ ...p, intended_exam_month: v })}/><Field label="Promised registration date" type="date" value={p.promised_registration_date} onChange={v => onChange({ ...p, promised_registration_date: v })}/><Field label="Actual registration date" type="date" value={p.actual_registration_date} onChange={v => onChange({ ...p, actual_registration_date: v })}/><Field label="Confirmed exam date" type="date" value={p.actual_exam_date} onChange={v => onChange({ ...p, actual_exam_date: v })}/><Pick label="Exam type" value={p.exam_type} onChange={v => onChange({ ...p, exam_type: v })} options={['IELTS Academic', 'IELTS General Training', 'UKVI Academic', 'UKVI General Training', 'IELTS Life Skills A1']}/><Pick label="Format" value={p.exam_format} onChange={v => onChange({ ...p, exam_format: v })} options={['Computer', 'Paper', 'Speaking & Listening']}/><Field label="Provider" value={p.provider} onChange={v => onChange({ ...p, provider: v })} placeholder="e.g. British Council / IDP"/><Field label="Test centre" value={p.test_centre} onChange={v => onChange({ ...p, test_centre: v })}/><Field label="Candidate / booking reference" value={p.candidate_reference} onChange={v => onChange({ ...p, candidate_reference: v })}/><Area label="Exam / registration notes" value={p.notes} onChange={v => onChange({ ...p, notes: v })}/></div></section>; }
