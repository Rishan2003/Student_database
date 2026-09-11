'use client';
import { useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Pick, Area, Band } from './fields';
import { Batch, Course, Snapshot, Student, emptyLevels, MODULES, display, levelNames, today } from './model';
import type { Mutate } from './student-form';
export function ActionDialog({ title, description, children, onClose, onSave, saveLabel = 'Save' }: {
    title: string;
    description?: string;
    children: ReactNode;
    onClose: () => void;
    onSave: () => Promise<void>;
    saveLabel?: string;
}) { const [busy, setBusy] = useState(false), [error, setError] = useState(''); return <Dialog open onOpenChange={v => !v && !busy && onClose()}><DialogContent className="action-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description || 'Update the details below.'}</DialogDescription></DialogHeader><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    await onSave();
    onClose();
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
}
finally {
    setBusy(false);
} }}>{children}{error && <p role="alert" className="error-banner">{error}</p>}<div className="form-actions"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} type="submit">{busy ? 'Saving…' : saveLabel}</Button></div></form></DialogContent></Dialog>; }
export function CourseDialog({ course, onClose, mutate }: {
    course?: Course;
    onClose: () => void;
    mutate: Mutate;
}) { const [v, set] = useState<Omit<Course, 'id'>>(course || { name: '', short_code: '', category: 'IELTS', description: '', default_duration_days: 90, is_active: true, ielts_tracking_enabled: true }); return <ActionDialog title={course ? 'Edit course' : 'Create a course'} onClose={onClose} onSave={async () => { if (!v.name.trim() || !v.short_code.trim())
    throw new Error('Course name and code are required.'); if (v.default_duration_days != null && (!Number.isInteger(v.default_duration_days) || v.default_duration_days < 1))
    throw new Error('Duration must be a positive whole number.'); await mutate('save_course', { ...v, id: course?.id }); }}><div className="form-grid"><Field label="Course name" required value={v.name} onChange={s => set({ ...v, name: s })} placeholder="e.g. IELTS Premium"/><Field label="Short code" required value={v.short_code} onChange={s => set({ ...v, short_code: s.toUpperCase() })} placeholder="e.g. IP"/><Field label="Category" value={v.category} onChange={s => set({ ...v, category: s })}/><Field label="Duration (days)" type="number" value={v.default_duration_days ?? ''} onChange={s => set({ ...v, default_duration_days: s ? +s : null })}/><Pick label="Course status" value={v.is_active ? 'active' : 'inactive'} onChange={s => set({ ...v, is_active: s === 'active' })} options={['active', 'inactive'].map(value => ({ value, label: display(value) }))}/><Area label="Description" value={v.description} onChange={s => set({ ...v, description: s })}/><label className="check-label"><Checkbox checked={v.ielts_tracking_enabled} onCheckedChange={c => set({ ...v, ielts_tracking_enabled: c === true })}/> IELTS tracking enabled</label></div></ActionDialog>; }
export function BatchDialog({ batch, courseId, data, onClose, mutate }: {
    batch?: Batch;
    courseId?: string;
    data: Snapshot;
    onClose: () => void;
    mutate: Mutate;
}) { const [v, set] = useState<Omit<Batch, 'id'>>(batch || { course_type_id: courseId || data.courses.find(c => c.is_active)?.id || '', branch_id: data.branches[0]?.id || '', batch_code: '', name: '', teacher_id: null, start_date: '', end_date: '', class_days: [], start_time: '', end_time: '', room: '', maximum_capacity: 25, status: 'planned', notes: '' }); return <ActionDialog title={batch ? 'Edit batch' : 'Create a batch'} onClose={onClose} onSave={async () => { if (!v.batch_code.trim() || !v.course_type_id || !v.branch_id)
    throw new Error('Choose a course and campus, and enter the batch code.'); if (v.end_date && v.start_date && v.end_date < v.start_date)
    throw new Error('End date must be on or after the start date.'); if (v.start_time && v.end_time && v.end_time <= v.start_time)
    throw new Error('End time must be after start time.'); if (v.maximum_capacity != null && (!Number.isInteger(v.maximum_capacity) || v.maximum_capacity < 1))
    throw new Error('Capacity must be a positive whole number.'); await mutate('save_batch', { ...v, id: batch?.id }); }}><div className="form-grid"><Pick label="Course" value={v.course_type_id} onChange={s => set({ ...v, course_type_id: s })} options={data.courses.filter(c => c.is_active || c.id === v.course_type_id).map(c => ({ value: c.id, label: c.name }))}/><Field label="Batch code" required value={v.batch_code} onChange={s => set({ ...v, batch_code: s })} placeholder="e.g. HICU-167"/><Field label="Batch name (optional)" value={v.name} onChange={s => set({ ...v, name: s })}/><Pick label="Campus" value={v.branch_id} onChange={s => set({ ...v, branch_id: s })} options={data.branches.map(b => ({ value: b.id, label: b.name }))}/><Pick label="Teacher" value={v.teacher_id || ''} onChange={s => set({ ...v, teacher_id: s || null })} options={[{ value: '', label: 'Unassigned' }, ...data.staff.filter(s => s.is_active).map(s => ({ value: s.id, label: s.full_name }))]}/><Pick label="Batch status" value={v.status} onChange={s => set({ ...v, status: s })} options={['planned', 'open', 'running', 'completed', 'cancelled'].map(value => ({ value, label: display(value) }))}/><Field label="Start date" type="date" value={v.start_date} onChange={s => set({ ...v, start_date: s })}/><Field label="End date" type="date" value={v.end_date} onChange={s => set({ ...v, end_date: s })}/><Field label="Start time" type="time" value={v.start_time} onChange={s => set({ ...v, start_time: s })}/><Field label="End time" type="time" value={v.end_time} onChange={s => set({ ...v, end_time: s })}/><Field label="Room" value={v.room} onChange={s => set({ ...v, room: s })}/><Field label="Capacity" type="number" value={v.maximum_capacity ?? ''} onChange={s => set({ ...v, maximum_capacity: s ? +s : null })}/><div className="span-all"><p className="field-label">Class days</p><div className="day-picker">{['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => <label key={day}><Checkbox checked={v.class_days.includes(day)} onCheckedChange={c => set({ ...v, class_days: c ? [...v.class_days, day] : v.class_days.filter(d => d !== day) })}/>{day.slice(0, 3)}</label>)}</div></div><Area label="Notes" value={v.notes} onChange={s => set({ ...v, notes: s })}/></div></ActionDialog>; }
export function EnrollmentDialog({ student, data, onClose, mutate }: {
    student: Student;
    data: Snapshot;
    onClose: () => void;
    mutate: Mutate;
}) { const [batch, setBatch] = useState(''), [date, setDate] = useState(today()), [status, setStatus] = useState('active'), [notes, setNotes] = useState(''); return <ActionDialog title="Enroll in another batch" description={student.full_name + ' · Existing course history will be preserved.'} onClose={onClose} onSave={async () => { if (!batch)
    throw new Error('Choose a batch.'); await mutate('add_enrollment', { student_id: student.id, batch_id: batch, enrollment_date: date, status, enrollment_notes: notes }); }}><div className="form-grid"><Pick label="Batch" value={batch} onChange={setBatch} options={[{ value: '', label: 'Choose a batch' }, ...data.batches.filter(b => ['open', 'running', 'planned'].includes(b.status) && !student.enrollments.some(e => e.batch_id === b.id && ['active', 'enrolled'].includes(e.status))).map(b => ({ value: b.id, label: `${b.batch_code} · ${data.courses.find(c => c.id === b.course_type_id)?.name}` }))]}/><Field label="Enrollment date" type="date" value={date} onChange={setDate}/><Pick label="Status" value={status} onChange={setStatus} options={['active', 'enrolled'].map(value => ({ value, label: display(value) }))}/><Area label="Enrollment notes" value={notes} onChange={setNotes}/></div></ActionDialog>; }
export function HistoryDialog({ student, onClose, mutate }: {
    student: Student;
    onClose: () => void;
    mutate: Mutate;
}) { const [type, setType] = useState('hexas'), [institute, setInstitute] = useState(''), [course, setCourse] = useState(''), [batch, setBatch] = useState(''), [date, setDate] = useState(''), [notes, setNotes] = useState(''); return <ActionDialog title="Add previous course" onClose={onClose} onSave={async () => { if (!course.trim() || !institute.trim())
    throw new Error('Enter the institution and course name.'); await mutate('add_history', { student_id: student.id, institution_type: type, institution_name: institute, course_name: course, batch_name: batch, completion_date: date, notes }); }}><div className="form-grid"><Pick label="Institution type" value={type} onChange={setType} options={[{ value: 'hexas', label: 'HEXA’S' }, { value: 'external', label: 'Another institute' }]}/><Field label={type === 'hexas' ? 'Campus name' : 'Institute name'} required value={institute} onChange={setInstitute}/><Field label="Course name" required value={course} onChange={setCourse}/><Field label="Batch (if known)" value={batch} onChange={setBatch}/><Field label="Completion date (if known)" value={date} type="date" onChange={setDate}/><Area label="Notes" value={notes} onChange={setNotes}/></div></ActionDialog>; }
export function AssessmentDialog({ student, data, onClose, mutate }: {
    student: Student;
    data: Snapshot;
    onClose: () => void;
    mutate: Mutate;
}) { const [levels, setLevels] = useState({ ...student.assessments[0]?.levels || emptyLevels }), [bands, setBands] = useState({ ...student.assessments[0]?.bands || emptyLevels }), [observation, setObservation] = useState(''), [enrollment, setEnrollment] = useState(student.enrollments.find(e => e.status === 'active')?.id || ''); return <ActionDialog title="Record a module assessment" description="Every assessment is saved separately so progress remains visible." onClose={onClose} onSave={async () => { if (!observation.trim() && MODULES.every(m => levels[m] == null && bands[m] == null))
    throw new Error('Add a level, estimated band or observation.'); await mutate('add_assessment', { student_id: student.id, enrollment_id: enrollment || null, levels, bands, observation }); }}><Pick label="Related enrollment" value={enrollment} onChange={setEnrollment} options={[{ value: '', label: 'General assessment' }, ...student.enrollments.map(e => ({ value: e.id, label: data.batches.find(b => b.id === e.batch_id)?.batch_code || 'Previous batch' }))]}/><div className="form-grid">{MODULES.map(m => <Pick key={m} label={display(m) + ' level'} value={levels[m] == null ? '' : String(levels[m])} onChange={v => setLevels({ ...levels, [m]: v ? +v : null })} options={levelNames.map((label, i) => ({ value: i ? String(i) : '', label }))}/>)}</div><h3 className="section-small">Estimated IELTS bands</h3><div className="form-grid">{MODULES.map(m => <Band key={m} label={display(m)} value={bands[m]} onChange={v => setBands({ ...bands, [m]: v })}/>)}<Area label="Teacher’s observation" value={observation} onChange={setObservation}/></div></ActionDialog>; }
