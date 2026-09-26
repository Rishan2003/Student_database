'use client';
import './club-attendance.css';
import { useEffect, useState } from 'react';
import { ClipboardList, Copy, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Field, Pick } from './fields';
import { ActionDialog } from './dialogs';
import { MODULES, dateLabel, display, today, type Module, type Snapshot, type Student } from './model';
import { CLUB_AI_PROMPT, canRecordClubs, clubSelection, matchClubRows, parseClubText, previousDay, sampleClubDay, sampleClubRoster, validClubDate, type ClubDay, type ClubEntry, type ClubMatch, type ClubRosterRow } from './club-model';
import * as api from './api';

const emptyDay: ClubDay = { sessions: [], attendance: [] };
const failure = (e: unknown) => e instanceof Error ? e.message : 'Could not load club attendance.';

export function ClubAttendance({ data, demo, initialBatchId, onOpen }: { data: Snapshot; demo: boolean; initialBatchId?: string; onOpen: (student: Student) => void }) {
    const initial = data.batches.find(b => b.id === initialBatchId);
    const [branch, setBranch] = useState(initial?.branch_id || data.me?.branch_id || data.branches[0]?.id || '');
    const [batch, setBatch] = useState(initial?.id || '');
    const [date, setDate] = useState(today());
    const [response, setResponse] = useState<{ key: string; source: Snapshot; day: ClubDay; error: string }>();
    const [revision, setRevision] = useState(0);
    const [importing, setImporting] = useState(false);
    const [correction, setCorrection] = useState<{ entry: ClubEntry; name: string; module: Module }>();
    const editable = canRecordClubs(data.me?.role);
    const key = `${branch}:${date}:${revision}:${demo}`;
    const validationError = !branch ? 'No campus is assigned to this account.' : !validClubDate(date) ? 'Choose a valid date, today or earlier.' : '';
    const loading = !validationError && (response?.key !== key || response?.source !== data);
    const day = !loading && !validationError ? response?.day || emptyDay : emptyDay;
    const error = validationError || (!loading ? response?.error || '' : '');
    useEffect(() => {
        if (validationError) return;
        let active = true;
        const promise = demo ? Promise.resolve(sampleClubDay(data, branch, date)) : api.clubDay(branch, date);
        promise.then(day => { if (active) setResponse({ key, source: data, day, error: '' }); }).catch(e => { if (active) setResponse({ key, source: data, day: emptyDay, error: failure(e) }); });
        return () => { active = false; };
    }, [branch, date, key, validationError, demo, data]);
    const batches = data.batches.filter(b => b.branch_id === branch);
    const currentBatch = batches.find(b => b.id === batch);
    const students = data.students.filter(s => s.enrollments.some(e => e.batch_id === batch && e.enrollment_date <= date));
    const entries = new Map(day.attendance.map(a => [`${a.student_id}:${day.sessions.find(s => s.id === a.session_id)?.module}`, a]));
    const count = students.filter(s => MODULES.some(m => entries.has(`${s.id}:${m}`))).length;
    return <>
        <div className="page-heading"><div><p className="eyebrow">DAILY CLUBS</p><h1>Club attendance</h1><p>Import one club sheet, then check attendance by batch.</p></div>
            {editable && <Button disabled={!branch} onClick={() => { toast.dismiss(); setImporting(true); }}><Upload size={17} /> Import club sheet</Button>}</div>
        <section className="form-card club-filters">
            <div className="club-filter-grid">
                <Pick label="Campus" value={branch} onChange={v => { setBranch(v); setBatch(''); }} options={data.branches.map(b => ({ value: b.id, label: b.name }))} />
                <Pick label="Batch" value={batch} onChange={setBatch} options={[{ value: '', label: 'Choose a batch' }, ...batches.map(b => ({ value: b.id, label: `${b.batch_code} · ${data.courses.find(c => c.id === b.course_type_id)?.name || ''}` }))]} />
                <Field label="Club date" type="date" value={date} onChange={setDate} />
            </div>
            <div className="club-date-actions"><div><Button size="sm" variant={date === today() ? 'default' : 'outline'} onClick={() => setDate(today())}>Today</Button><Button size="sm" variant={date === previousDay() ? 'default' : 'outline'} onClick={() => setDate(previousDay())}>Yesterday</Button></div><Button variant="ghost" size="sm" disabled={loading} onClick={() => setRevision(v => v + 1)}><RefreshCw size={15} /> Refresh</Button></div>
        </section>
        {error ? <p role="alert" className="error-banner">{error}</p> : loading ? <p className="help" role="status">Loading attendance…</p> : !currentBatch ? <section className="form-card club-empty"><ClipboardList /><h2>Choose your batch</h2><p className="help">See which students attended Listening, Reading, Writing and Speaking clubs on the selected day.</p></section> : <section className="student-surface club-results">
            <div className="club-results-heading"><h2>{currentBatch.batch_code} · {dateLabel(date)}</h2><p>{count} of {students.length} students have club attendance recorded.</p></div>
            <Table className="club-table"><TableHeader><TableRow><TableHead>Student</TableHead>{MODULES.map(m => <TableHead key={m}>{display(m)}<small>{day.sessions.some(s => s.module === m) ? 'Sheet imported' : 'No sheet imported'}</small></TableHead>)}</TableRow></TableHeader>
                <TableBody>{students.map(s => <TableRow key={s.id}><TableCell><button className="club-student" onClick={() => onOpen(s)}><strong>{s.full_name}</strong><small>{s.student_code}</small></button></TableCell>{MODULES.map(m => {
                    const entry = entries.get(`${s.id}:${m}`);
                    return <TableCell key={m}>{entry ? editable ? <button className="club-present" aria-label={`Correct ${display(m)} attendance for ${s.full_name}`} onClick={() => setCorrection({ entry, name: s.full_name, module: m })}>Attended</button> : <span className="club-present">Attended</span> : <span className="club-unlisted">{day.sessions.some(session => session.module === m) ? 'Not listed' : '—'}</span>}</TableCell>;
                })}</TableRow>)}</TableBody></Table>
            {!students.length && <p className="club-footnote">No students were enrolled in this batch by the selected date.</p>}
            <p className="club-footnote">“Not listed” means no attendance was saved for that student; it does not confirm absence.{editable && ' Select an Attended entry to correct a mistake.'}</p>
        </section>}
        {importing && <ClubImportDialog data={data} demo={demo} initialBranch={branch} initialDate={date} onClose={() => setImporting(false)} onSaved={(campus, savedDate) => { if (campus !== branch) setBatch(''); setBranch(campus); setDate(savedDate); setRevision(v => v + 1); }} />}
        {correction && <ActionDialog title="Correct club attendance" description={`${correction.name} · ${display(correction.module)} · ${dateLabel(date)}`} saveLabel="Remove attendance" onClose={() => setCorrection(undefined)} onSave={async () => {
            if (demo) throw new Error('Sample attendance is read-only.');
            await api.clubWrite('remove', { attendance_id: correction.entry.id });
            setRevision(v => v + 1); toast.success('Attendance entry removed');
        }}><p>Remove this entry if it was matched to the wrong student or club. You can import the corrected entry afterwards.</p></ActionDialog>}
    </>;
}

function ClubImportDialog({ data, demo, initialBranch, initialDate, onClose, onSaved }: { data: Snapshot; demo: boolean; initialBranch: string; initialDate: string; onClose: () => void; onSaved: (branch: string, date: string) => void }) {
    const [branch, setBranch] = useState(initialBranch), [date, setDate] = useState(initialDate), [module, setModule] = useState<Module | ''>('');
    const [text, setText] = useState(''), [rows, setRows] = useState<ClubMatch[] | null>(null), [roster, setRoster] = useState<ClubRosterRow[]>([]);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const selection = clubSelection(rows || [], roster);
    const preview = async () => {
        setError(''); setBusy(true);
        try {
            if (!branch || !module) throw new Error('Choose a campus and module.');
            if (!validClubDate(date)) throw new Error('Choose a valid club date, today or earlier.');
            const input = parseClubText(text);
            const list = demo ? sampleClubRoster(data, branch, date) : await api.clubRoster(branch, date);
            setRoster(list); setRows(matchClubRows(input, list));
        } catch (e) { setError(failure(e)); } finally { setBusy(false); }
    };
    const save = async () => {
        setError(''); setBusy(true);
        try {
            if (demo) throw new Error('This preview uses sample students. Real attendance can be saved after database setup.');
            if (!rows || selection.unresolved || !selection.ids.length) throw new Error('Match or skip each row and select at least one student.');
            const result = await api.clubWrite('import', { branch_id: branch, club_date: date, module, enrollment_ids: selection.ids });
            toast.success(`${result.added} attendance ${result.added === 1 ? 'entry' : 'entries'} saved${result.already_recorded ? ` · ${result.already_recorded} already recorded` : ''}`);
            onSaved(branch, date); onClose();
        } catch (e) { setError(failure(e)); } finally { setBusy(false); }
    };
    const matchOptions = [{ value: '', label: 'Choose student' }, { value: '__skip', label: 'Skip this row' }, ...roster.map(r => ({ value: r.enrollment_id, label: `${r.full_name} · ${r.batch_code} · ${r.student_code} · ${r.enrollment_date}` }))];
    return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent className="action-dialog club-import-dialog"><DialogHeader><DialogTitle>{rows ? 'Check the matches' : 'Import club sheet'}</DialogTitle><DialogDescription>{rows ? 'Check the names against the sheet. Choose the correct student or explicitly skip an unclear row.' : 'Extract names from your sheet photo with AI, then paste the result here.'}</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); void (rows ? save() : preview()); }}><fieldset disabled={busy} className="club-import-fields">
            {rows ? <>
                <div className="club-import-session"><strong>{display(module)} club · {dateLabel(date)}</strong><span>{data.branches.find(b => b.id === branch)?.name}</span></div>
                <p className="club-import-count" role="status">{selection.ids.length} {selection.ids.length === 1 ? 'student' : 'students'} ready · {selection.unresolved} to check · {selection.skipped} skipped{selection.duplicates ? ` · ${selection.duplicates} duplicate rows ignored` : ''}</p>
                <div className="club-match-list">{rows.map((row, i) => <div key={i} className={`club-match-row ${!row.enrollmentId ? 'club-needs-match' : ''}`}><div><strong>{i + 1}. {row.name || 'Unreadable name'}</strong><small>Sheet batch: {row.batch || 'Unreadable'} · {row.enrollmentId === '__skip' ? 'Skipped' : row.reason}</small></div><Pick label={`Match row ${i + 1}`} value={row.enrollmentId} onChange={v => setRows(rows.map((r, index) => index === i ? { ...r, enrollmentId: v, reason: v ? 'Selected manually' : 'Choose the student' } : r))} options={matchOptions} />{row.enrollmentId && row.enrollmentId !== '__skip' && <small>Student ID: {roster.find(r => r.enrollment_id === row.enrollmentId)?.student_code}</small>}</div>)}</div>
            </> : <>
                <div className="form-grid"><Pick label="Club campus" value={branch} onChange={setBranch} options={data.branches.map(b => ({ value: b.id, label: b.name }))} /><Pick label="Club module" value={module} onChange={v => setModule(v as Module)} options={[{ value: '', label: 'Choose module' }, ...MODULES.map(m => ({ value: m, label: display(m) }))]} /><Field label="Session date" type="date" required value={date} onChange={setDate} /></div>
                <div className="field club-paste"><label htmlFor="club-sheet-text">Names and batches</label><Textarea id="club-sheet-text" rows={7} value={text} onChange={e => setText(e.target.value)} placeholder={'Ayesha Rahman | HICU-301\nFarhan Ahmed | 299'} /><p className="help">One Name | Batch per line, or a JSON array with name and batch fields. First names and batch formats such as PRE-122, 122 (PRE), and 122 are supported. Check the full name before saving.</p></div>
                <label className="club-file-label">Or open a text / JSON file<input type="file" accept=".txt,.json,text/plain,application/json" onChange={async e => {
                    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
                    setError(''); setBusy(true);
                    try { if (file.size > 200000) throw new Error('Choose a file smaller than 200 KB.'); setText(await file.text()); } catch (e) { setError(failure(e)); } finally { setBusy(false); }
                }} /></label>
                <details className="club-ai-help"><summary>Get text from a sheet photo</summary><p>Attach your photo to an AI that can read images, and use this prompt. Paste its answer above.</p><pre>{CLUB_AI_PROMPT}</pre><Button type="button" size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(CLUB_AI_PROMPT); toast.success('AI prompt copied'); } catch { setError('Select and copy the prompt shown above.'); } }}><Copy size={14} /> Copy AI prompt</Button></details>
            </>}
        </fieldset>{error && <p role="alert" className="error-banner">{error}</p>}
            <div className="form-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => rows ? (setRows(null), setError('')) : onClose()}>{rows ? 'Back to text' : 'Cancel'}</Button><Button type="submit" disabled={busy || !!rows && (selection.unresolved > 0 || selection.ids.length === 0)}>{busy ? 'Please wait…' : rows ? `Save ${selection.ids.length} ${selection.ids.length === 1 ? 'student' : 'students'}` : 'Check matches'}</Button></div>
        </form>
    </DialogContent></Dialog>;
}
