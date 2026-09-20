'use client';
import "./student-review.css";
import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActionDialog } from './dialogs';
import { Area, Band, Field, Pick } from './fields';
import {
    canAcademic, dateLabel, display, emptyModuleStates, hicuEnrollments, MODULES, MODULE_STATES,
    REVIEW_CATEGORIES, reviewNames, reviewSchema, today, weeklyReviewSchema,
    type ReviewDraft, type ReviewValues, type Snapshot, type Student, type WeeklyReview,
} from './model';
import type { Mutate } from './student-form';

function draftOf(value?: ReviewValues | null): ReviewDraft {
    return { category: value?.category || '', expected_band: value?.expected_band ?? null, module_states: { ...emptyModuleStates, ...value?.module_states } };
}

export function ReviewBadge({ category }: { category?: ReviewValues['category'] | null }) {
    return <span className={`status-badge review-category ${category || 'unreviewed'}`}>{category ? reviewNames[category] : 'Not reviewed'}</span>;
}

function ReviewFields({ value, onChange }: { value: ReviewDraft; onChange: (v: ReviewDraft) => void }) {
    return <>
        <div className="form-grid">
            <Pick label="Student category" value={value.category} onChange={v => onChange({ ...value, category: v as ReviewDraft['category'] })}
                options={[{ value: '', label: 'Choose category' }, ...REVIEW_CATEGORIES.map(v => ({ value: v, label: reviewNames[v] }))]} />
            <Band label="Expected overall band" value={value.expected_band} onChange={v => onChange({ ...value, expected_band: v })} />
        </div>
        <p className="help">The band faculty expect the student to achieve. Leave it unset when IELTS bands do not apply.</p>
        <h3 className="section-small">Current module states</h3>
        <div className="form-grid">
            {MODULES.map(m => <Pick key={m} label={`${display(m)} state`} value={value.module_states[m] || ''}
                onChange={v => onChange({ ...value, module_states: { ...value.module_states, [m]: v || null } })}
                options={[{ value: '', label: 'Not assessed' }, ...MODULE_STATES.map(v => ({ value: v, label: reviewNames[v] }))]} />)}
        </div>
    </>;
}

function ReviewSummary({ review }: { review?: ReviewValues | null }) {
    return <>
        <div className="review-summary">
            <ReviewBadge category={review?.category} />
            <span className="review-expected">Expected overall band <strong>{review?.expected_band?.toFixed(1) ?? 'Not set'}</strong></span>
        </div>
        <div className="review-modules">
            {MODULES.map(m => <div key={m}><span>{display(m)}</span><strong className={review?.module_states[m] || ''}>{review?.module_states[m] ? reviewNames[review.module_states[m]!] : 'Not assessed'}</strong></div>)}
        </div>
    </>;
}

export function StudentReviewCard({ student, data, mutate }: { student: Student; data: Snapshot; mutate: Mutate }) {
    const [editing, setEditing] = useState(false);
    return <section className="form-card student-review-card">
        <div className="section-heading"><h2>Student review</h2>{canAcademic(data.me?.role) && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Update review</Button>}</div>
        <ReviewSummary review={student.review} />
        {student.review && <p className="help review-credit">{student.review.author_name} · Updated {dateLabel(student.review.updated_at.slice(0, 10))}</p>}
        {editing && <CurrentReviewDialog student={student} mutate={mutate} onClose={() => setEditing(false)} />}
    </section>;
}

function CurrentReviewDialog({ student, mutate, onClose }: { student: Student; mutate: Mutate; onClose: () => void }) {
    const [value, setValue] = useState(() => draftOf(student.review));
    // Keep the version loaded when editing began, so a concurrent edit cannot be overwritten.
    const [version] = useState(student.review?.updated_at ?? null);
    return <ActionDialog title="Update student review" description="Set the current condition and faculty's expected band." onClose={onClose} onSave={async () => {
        const parsed = reviewSchema.safeParse(value);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        await mutate('save_student_review', { student_id: student.id, ...parsed.data, updated_at: version });
    }}><ReviewFields value={value} onChange={setValue} /></ActionDialog>;
}

export function WeeklyReviewPanel({ student, data, mutate }: { student: Student; data: Snapshot; mutate: Mutate }) {
    const enrollments = hicuEnrollments(student, data);
    const [selected, setSelected] = useState(() => enrollments.find(e => ['active', 'enrolled'].includes(e.status))?.id || enrollments[0]?.id || '');
    const enrollment = enrollments.find(e => e.id === selected) || enrollments[0];
    const [week, setWeek] = useState('1');
    const [editing, setEditing] = useState(false);
    if (!enrollment) return null;
    const batch = data.batches.find(b => b.id === enrollment.batch_id);
    const course = data.courses.find(c => c.id === batch?.course_type_id);
    const records = (student.weekly_reviews || []).filter(r => r.enrollment_id === enrollment.id);
    const record = records.find(r => r.week === Number(week));
    const editable = canAcademic(data.me?.role);
    return <section className="form-card weekly-review-panel">
        <div className="section-heading"><div><h2>Four-week monitoring</h2><p className="help">{course?.name || 'HICU'} · {batch?.batch_code || 'Previous batch'} · {records.length}/4 weeks recorded</p></div></div>
        {enrollments.length > 1 && <div className="weekly-enrollment"><Pick label="HICU enrollment" value={enrollment.id} onChange={v => { setSelected(v); setWeek('1'); }}
            options={enrollments.map(e => ({ value: e.id, label: `${data.batches.find(b => b.id === e.batch_id)?.batch_code || 'Previous batch'} · ${dateLabel(e.enrollment_date)}` }))} /></div>}
        <Tabs value={week} onValueChange={setWeek}>
            <TabsList className="review-week-tabs" aria-label="Monitoring week">{[1, 2, 3, 4].map(w => <TabsTrigger key={w} value={String(w)}>Week {w}{records.some(r => r.week === w) && <span className="week-saved" aria-label="Recorded" />}</TabsTrigger>)}</TabsList>
            <TabsContent value={week}>
                <div className="section-heading weekly-heading"><h3>Week {week}{record && <span className="help"> · {dateLabel(record.review_date)}</span>}</h3>
                    {editable && <Button size="sm" variant={record ? 'outline' : 'default'} onClick={() => setEditing(true)}>{record ? <Pencil /> : <Plus />}{record ? 'Edit week' : 'Record week'}</Button>}</div>
                {record ? <>
                    <ReviewSummary review={record} />
                    <dl className="weekly-notes">
                        <div><dt>Condition & behaviour</dt><dd>{record.condition_notes || 'No notes recorded.'}</dd></div>
                        <div><dt>Meeting discussion</dt><dd>{record.discussion || 'No discussion recorded.'}</dd></div>
                        <div><dt>Steps taken / next steps</dt><dd>{record.steps_taken || 'No steps recorded.'}</dd></div>
                    </dl>
                    <p className="help review-credit">{record.author_name} · Updated {dateLabel(record.updated_at.slice(0, 10))}</p>
                </> : <p className="weekly-empty">No review recorded for Week {week}. {editable ? 'Record the condition, discussion and steps from this week’s meeting.' : 'The academic team has not recorded this week yet.'}</p>}
            </TabsContent>
        </Tabs>
        {editing && <WeeklyReviewDialog key={`${enrollment.id}-${week}`} student={student} record={record} enrollmentId={enrollment.id} week={Number(week)} mutate={mutate} onClose={() => setEditing(false)} />}
    </section>;
}

function WeeklyReviewDialog({ student, record, enrollmentId, week, mutate, onClose }: {
    student: Student; record?: WeeklyReview; enrollmentId: string; week: number; mutate: Mutate; onClose: () => void;
}) {
    const [value, setValue] = useState(() => draftOf(record || student.review));
    const [date, setDate] = useState(record?.review_date || today());
    const [condition, setCondition] = useState(record?.condition_notes || '');
    const [discussion, setDiscussion] = useState(record?.discussion || '');
    const [steps, setSteps] = useState(record?.steps_taken || '');
    const [version] = useState(record?.updated_at ?? null);
    return <ActionDialog title={`${record ? 'Edit' : 'Record'} Week ${week}`} description="Save this week's meeting record. Past weeks and the current profile stay separate." saveLabel="Save week" onClose={onClose} onSave={async () => {
        const parsed = weeklyReviewSchema.safeParse({ ...value, enrollment_id: enrollmentId, week, review_date: date, condition_notes: condition, discussion, steps_taken: steps });
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        await mutate('save_weekly_review', { student_id: student.id, ...parsed.data, updated_at: version });
    }}>
        <Field label="Meeting date" type="date" required value={date} onChange={setDate} />
        <ReviewFields value={value} onChange={setValue} />
        <div className="weekly-note-fields">
            <Area label="Condition & behaviour" value={condition} onChange={setCondition} placeholder="Progress, difficulties, attendance or classroom behaviour…" />
            <Area label="Meeting discussion" value={discussion} onChange={setDiscussion} placeholder="What did the faculty discuss?" />
            <Area label="Steps taken / next steps" value={steps} onChange={setSteps} placeholder="Support provided, action agreed, and who will follow up…" />
        </div>
    </ActionDialog>;
}
