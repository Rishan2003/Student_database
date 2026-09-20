'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, GraduationCap, Layers, FileChartColumn, Settings, Plus, FileDown, ArrowUpRight, CalendarDays, Clock3, CheckCheck, RefreshCw, LogOut, ShieldCheck, Search, Pencil, BookOpen, AlertCircle, Database, ClipboardList } from 'lucide-react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { demoData } from './demo';
import * as api from './api';
import { Snapshot, Student, Course, Batch, View, Filters, EMPTY_FILTERS, filterStudents, filterLabels, display, isOverdue, isUpcoming, examDate, dateLabel, canCore, canManage, today, Staff, ROLES } from './model';
import { StudentForm } from './student-form';
import { StudentProfile } from './student-profile';
import { StudentTable } from './student-table';
import { ClubAttendance } from './club-attendance';
import { FilterPanel } from './filter-panel';
import { ReportDialog } from './report-dialog';
import { CourseDialog, BatchDialog, ActionDialog } from './dialogs';
import { Pick, Field } from './fields';
const blank: Snapshot = { students: [], courses: [], batches: [], branches: [], staff: [], me: null };
const nav = [{ id: 'students' as View, label: 'Students', icon: Users }, { id: 'courses' as View, label: 'Courses', icon: GraduationCap }, { id: 'batches' as View, label: 'Batches', icon: Layers }, { id: 'clubs' as View, label: 'Club attendance', icon: ClipboardList }, { id: 'reports' as View, label: 'Reports', icon: FileChartColumn }];
type Mode = 'loading' | 'ready' | 'demo' | 'signedout' | 'error';
export function StudentDesk() {
    const [data, setData] = useState<Snapshot>(blank), [mode, setMode] = useState<Mode>('loading'), [view, setView] = useState<View>('students');
    const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS }), [sort, setSort] = useState('name'), [selected, setSelected] = useState(''), [editing, setEditing] = useState(false), [creating, setCreating] = useState(false), [creatingBatchId, setCreatingBatchId] = useState('');
    const [dialog, setDialog] = useState(''), [editCourse, setEditCourse] = useState<Course>(), [editBatch, setEditBatch] = useState<Batch>(), [initialCourse, setInitialCourse] = useState(''), [error, setError] = useState(''), [refreshing, setRefreshing] = useState(false), [reportRows, setReportRows] = useState<Student[] | null>(null), [reportLabels, setReportLabels] = useState<string[]>([]);
    const [staffEdit, setStaffEdit] = useState<Staff>();
    const [clubBatch, setClubBatch] = useState('');
    const refresh = useCallback(async () => { const s = await api.snapshot(); setData(s); setMode('ready'); setError(''); }, []);
    useEffect(() => { let active = true; let unsubscribe: (() => void) | undefined; api.initialize().then(async (c) => { if (!active)
        return; if (!c) {
        setData(demoData());
        setMode('demo');
        return;
    } const { data: { session } } = await c.auth.getSession(); if (!active)
        return; if (session) {
        try {
            await refresh();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load records.');
            setMode('error');
        }
    }
    else
        setMode('signedout'); const { data: { subscription } } = c.auth.onAuthStateChange((event, session) => { if (!active)
        return; if (!session) {
        setData(blank);
        setSelected('');
        setMode('signedout');
    }
    else if (event === 'SIGNED_IN')
        void refresh().catch(e => { setError(String(e)); setMode('error'); }); }); unsubscribe = () => subscription.unsubscribe(); }).catch(e => { if (active) {
        setError(e instanceof Error ? e.message : 'Could not load the app.');
        setMode('error');
    } }); return () => { active = false; unsubscribe?.(); }; }, [refresh]);
    const changeFilters = useCallback((f: Filters) => setFilters(f), []);
    const openStudent = useCallback((s: Student) => { setSelected(s.id); setCreating(false); setCreatingBatchId(''); setEditing(false); }, []);
    const student = data.students.find(s => s.id === selected);
    const filtered = useMemo(() => { const result = filterStudents(data.students, filters, data.batches); return [...result].sort((a, b) => sort === 'exam' ? (examDate(a) || '9999').localeCompare(examDate(b) || '9999') : sort === 'recent' ? b.created_at.localeCompare(a.created_at) : a.full_name.localeCompare(b.full_name)); }, [data.students, data.batches, filters, sort]);
    const labels = useMemo(() => filterLabels(filters, data), [filters, data]);
    const navigate = (v: View) => { setClubBatch(''); setView(v); setSelected(''); setEditing(false); setCreating(false); setCreatingBatchId(''); };
    const addStudentToBatch = (batchId: string) => { setSelected(''); setEditing(false); setCreatingBatchId(batchId); setCreating(true); };
    const showReport = (rows = filtered, ls = labels) => { setReportRows(rows); setReportLabels(ls); };
    const mutate = useCallback(async (action: string, payload: unknown) => {
        if (mode === 'demo')
            throw new Error('This preview uses sample data. Database setup must finish before real records can be saved.');
        await api.write(action, payload);
        await refresh();
        toast.success('Changes saved');
    }, [mode, refresh]);
    useEffect(() => { const mc = (document as Document & {
        modelContext?: {
            registerTool: (t: unknown, o: {
                signal: AbortSignal;
            }) => Promise<void> | void;
        };
    }).modelContext; if (!mc?.registerTool)
        return; const c = new AbortController(); const tools = [{ name: 'filter_ielts_students', title: 'Filter IELTS students', description: 'Apply a student search and registration filter to the visible list. Does not edit student records.', inputSchema: { type: 'object', properties: { search: { type: 'string' }, registration: { type: 'string', enum: ['all', 'registered', 'not_registered', 'planning', 'promised', 'not_planning', 'overdue'] } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: true }, execute: (v: unknown) => { if (!v || typeof v !== 'object')
                throw new Error('Expected an object'); const p = v as {
                search?: string;
                registration?: string;
            }; if (Object.keys(p).some(k => !['search', 'registration'].includes(k)))
                throw new Error('Unknown filter'); if (p.search !== undefined && typeof p.search !== 'string')
                throw new Error('Invalid search'); if (p.registration && !['all', 'registered', 'not_registered', 'planning', 'promised', 'not_planning', 'overdue'].includes(p.registration))
                throw new Error('Invalid registration'); const f = { ...filters, ...p }; setFilters(f); setView('students'); setSelected(''); return { matchingStudents: filterStudents(data.students, f, data.batches).length }; } }, { name: 'read_filtered_student_count', title: 'Read filtered student count', description: 'Return the number of matching students and active filters from the visible student list.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ count: filtered.length, filters: labels }) }]; for (const t of tools) {
        try {
            void Promise.resolve(mc.registerTool(t, { signal: c.signal })).catch(() => { });
        }
        catch { }
    } return () => c.abort(); }, [data, filters, filtered.length, labels]);
    if (mode === 'signedout')
        return <Login onSuccess={refresh}/>;
    return <SidebarProvider style={{ '--sidebar-width': '15rem' } as React.CSSProperties}><Sidebar className="desk-sidebar"><SidebarHeader className="brand-area"><a className="brand" href="/" aria-label="HEXA’S Student Desk"><span className="brand-mark">H<span /></span><span><strong>HEXA’S</strong><small>IELTS STUDENT DESK</small></span></a></SidebarHeader><SidebarContent><SidebarGroup><p className="nav-label">WORKSPACE</p><SidebarMenu>{nav.map(n => <SidebarMenuItem key={n.id}><SidebarMenuButton isActive={view === n.id} onClick={() => navigate(n.id)} className="nav-item"><n.icon /><span>{n.label}</span>{n.id === 'students' && data.students.length > 0 && <span className="nav-count">{data.students.length}</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup><SidebarGroup className="smart-lists"><p className="nav-label">QUICK VIEWS</p><button onClick={() => { navigate('students'); setFilters({ ...EMPTY_FILTERS, registration: 'overdue' }); }}><Clock3 /> Registration overdue <span>{data.students.filter(s => isOverdue(s)).length}</span></button><button onClick={() => { navigate('students'); const end = new Date(Date.parse(today()) + 30 * 86400000).toISOString().slice(0, 10); setFilters({ ...EMPTY_FILTERS, examFrom: today(), examTo: end }); }}><CalendarDays /> Exams in 30 days <span>{data.students.filter(s => isUpcoming(s)).length}</span></button><button onClick={() => { navigate('students'); setFilters({ ...EMPTY_FILTERS, module: 'writing', level: '2' }); }}><BookOpen /> Developing writers</button></SidebarGroup></SidebarContent><SidebarFooter className="sidebar-bottom"><SidebarMenuButton className="nav-item" isActive={view === 'settings'} onClick={() => navigate('settings')}><Settings /> Workspace settings</SidebarMenuButton><div className="workspace-account"><span className="account-avatar">HE</span><div><strong>{data.me?.full_name || 'HEXA’S Education'}</strong><small>{mode === 'demo' ? 'Sample workspace' : data.me ? display(data.me.role) : 'Student management'}</small></div></div></SidebarFooter></Sidebar><SidebarInset className="desk-main"><header className="topbar"><div><SidebarTrigger /><span className="breadcrumb">Workspace <span>/</span> {nav.find(n => n.id === view)?.label || 'Settings'}</span></div><div className="topbar-right"><span className="private-label"><ShieldCheck size={15}/> Private workspace</span>{mode === 'ready' && <Button size="icon" variant="ghost" onClick={async () => { await api.getClient()?.auth.signOut(); }} aria-label="Sign out"><LogOut size={17}/></Button>}</div></header>
 {mode === 'ready' && !data.me?.is_active && <div className="preview-banner"><ShieldCheck size={17}/><span>Your account is awaiting administrator activation and campus access.</span></div>}{mode === 'demo' && <div className="preview-banner"><AlertCircle size={17}/><span><strong>Interactive preview</strong> · Sample students only. Real record saving is awaiting database setup.</span><button onClick={() => navigate('settings')}>Connection status <ArrowUpRight size={14}/></button></div>}
 <div className="workspace-content">{mode === 'loading' ? <div className="loading-layout"><Skeleton className="h-12 w-64"/><Skeleton className="h-32 w-full"/><Skeleton className="h-96 w-full"/></div> : mode === 'error' ? <div className="form-card"><h1>Couldn’t load your workspace</h1><p className="error-banner">{error}</p><Button onClick={() => void refresh().catch(e => setError(String(e)))}>Try again</Button></div> : creating || editing ? <StudentForm data={data} student={editing ? student : undefined} initialBatchId={creating ? creatingBatchId : undefined} onBack={() => { setCreating(false); setCreatingBatchId(''); setEditing(false); }} onOpen={openStudent} mutate={mutate}/> : student ? <StudentProfile student={student} data={data} mutate={mutate} onBack={() => setSelected('')} onEdit={() => setEditing(true)} onReport={() => showReport([student], [`Student: ${student.student_code}`])}/> : <>
 {view === 'clubs' && <ClubAttendance key={clubBatch || 'clubs'} data={data} demo={mode === 'demo'} initialBatchId={clubBatch} onOpen={openStudent}/>}
 {(view === 'students' || view === 'reports') && <><div className="page-heading"><div><p className="eyebrow">{view === 'reports' ? 'REPORTS & EXPORTS' : 'STUDENT MANAGEMENT'}</p><h1>{view === 'reports' ? 'Student reports' : 'All students'} <span className="title-count">{data.students.length}</span></h1><p>{view === 'reports' ? 'Build a focused report from the students you want to see.' : 'Every student. Every course. A clear next step.'}</p></div><div className="heading-actions"><Button variant="outline" onClick={() => showReport()} disabled={!filtered.length}><FileDown size={17}/> Export PDF</Button>{canCore(data.me?.role) && <Button onClick={() => navigate('batches')}><Layers size={18}/> Add student by batch</Button>}</div></div>
 <div className="stats-grid"><Stat label="Total students" value={data.students.length} note="Across all your courses" icon={Users} onClick={() => setFilters({ ...EMPTY_FILTERS })}/><Stat label="Registered for IELTS" value={data.students.filter(s => s.plan.registration_status === 'registered').length} note="Registration confirmed" icon={CheckCheck} tone="green" onClick={() => setFilters({ ...EMPTY_FILTERS, registration: 'registered' })}/><Stat label="Not registered" value={data.students.filter(s => s.plan.registration_status !== 'registered').length} note="Planning their next step" icon={CalendarDays} tone="blue" onClick={() => setFilters({ ...EMPTY_FILTERS, registration: 'not_registered' })}/><Stat label="Registration overdue" value={data.students.filter(s => isOverdue(s)).length} note="Past the promised date" icon={Clock3} tone="red" onClick={() => setFilters({ ...EMPTY_FILTERS, registration: 'overdue' })}/></div>
 <section className="student-surface"><div className="surface-heading"><Tabs value={['all', 'registered', 'not_registered'].includes(filters.registration) ? filters.registration : 'custom'} onValueChange={v => setFilters({ ...filters, registration: v })}><TabsList variant="line" className="list-tabs"><TabsTrigger value="all">All students</TabsTrigger><TabsTrigger value="not_registered">Not registered</TabsTrigger><TabsTrigger value="registered">Registered</TabsTrigger></TabsList></Tabs><Button variant="ghost" size="icon" aria-label="Refresh students" disabled={refreshing || mode === 'demo'} onClick={async () => { setRefreshing(true); try {
                await refresh();
            }
            catch (e) {
                toast.error(String(e));
            }
            finally {
                setRefreshing(false);
            } }}><RefreshCw size={16} className={refreshing ? 'spin' : ''}/></Button></div><FilterPanel data={data} filters={filters} onChange={changeFilters}/><div className="results-toolbar"><p><strong>{filtered.length}</strong> students {labels.length ? 'match your filters' : 'in your workspace'}</p><Pick label="Sort by" value={sort} onChange={setSort} options={[{ value: 'name', label: 'Name A–Z' }, { value: 'recent', label: 'Recently added' }, { value: 'exam', label: 'Exam date' }]}/></div><StudentTable students={filtered} data={data} onOpen={openStudent} onReset={() => setFilters({ ...EMPTY_FILTERS })}/></section><p className="table-caption">L · Listening &nbsp; R · Reading &nbsp; W · Writing &nbsp; S · Speaking <span>Module levels use a staff-assessed 1–5 scale.</span></p></>}
 {view === 'courses' && <><div className="page-heading"><div><p className="eyebrow">COURSE MANAGEMENT</p><h1>Courses</h1><p>Create course types, then organize students into batches.</p></div>{data.me?.role === 'super_admin' && <Button onClick={() => { setEditCourse(undefined); setDialog('course'); }}><Plus /> Create course</Button>}</div><div className="course-grid">{data.courses.map(c => { const batches = data.batches.filter(b => b.course_type_id === c.id); const students = data.students.filter(s => s.enrollments.some(e => batches.some(b => b.id === e.batch_id))); return <article className="course-card" key={c.id}><div className="section-heading"><span className="course-code">{c.short_code}</span><span className={'status-badge ' + (c.is_active ? 'active' : 'neutral')}>{c.is_active ? 'Active' : 'Inactive'}</span></div><h2>{c.name}</h2><p>{c.description || c.category}</p><div className="course-stats"><div><strong>{batches.length}</strong><span>Batches</span></div><div><strong>{students.length}</strong><span>Students</span></div><div><strong>{c.default_duration_days || '—'}</strong><span>Days</span></div></div><div className="card-actions"><Button variant="outline" onClick={() => { navigate('students'); setFilters({ ...EMPTY_FILTERS, course: c.id }); }}>View students <ArrowUpRight /></Button>{canManage(data.me?.role) && <>{data.me?.role === 'super_admin' && <Button variant="ghost" aria-label={'Edit ' + c.name} size="icon" onClick={() => { setEditCourse(c); setDialog('course'); }}><Pencil size={15}/></Button>}<Button size="sm" onClick={() => { setInitialCourse(c.id); setEditBatch(undefined); setDialog('batch'); }}><Plus /> Batch</Button></>}</div></article>; })}{!data.courses.length && <div className="form-card"><h2>Create your first course</h2><p className="help">Add IELTS Premium, HICU, Spoken English, or any other course your institute offers.</p></div>}</div></>}
 {view === 'batches' && <><div className="page-heading"><div><p className="eyebrow">CLASS ORGANIZATION</p><h1>Batches</h1><p>Create a batch first, then register students inside that batch.</p></div>{canManage(data.me?.role) && <Button disabled={!data.courses.length} onClick={() => { setEditBatch(undefined); setInitialCourse(''); setDialog('batch'); }}><Plus /> Create batch</Button>}</div><div className="batch-grid">{data.batches.map(b => { const students = data.students.filter(s => s.enrollments.some(e => e.batch_id === b.id && ['active', 'enrolled'].includes(e.status))); const openForEnrollment = ['planned', 'open', 'running'].includes(b.status) && (b.maximum_capacity == null || students.length < b.maximum_capacity); return <article className="batch-card" key={b.id}><div className="section-heading"><span className="status-badge blue">{data.courses.find(c => c.id === b.course_type_id)?.name}</span><span className={'status-badge ' + b.status}>{display(b.status)}</span></div><h2>{b.batch_code}</h2>{b.name && <p>{b.name}</p>}<div className="batch-details"><p><Users />{students.length}{b.maximum_capacity ? ' / ' + b.maximum_capacity : ''} students</p><p><CalendarDays />{b.class_days.map(d => d.slice(0, 3)).join(' · ') || 'Schedule not set'}</p><p><Clock3 />{b.start_time?.slice(0, 5) || '—'}{b.end_time ? ' – ' + b.end_time.slice(0, 5) : ''}{b.room ? ' · ' + b.room : ''}</p><p><GraduationCap />{data.staff.find(s => s.id === b.teacher_id)?.full_name || 'Teacher unassigned'}</p></div><div className="batch-period">{dateLabel(b.start_date)} → {dateLabel(b.end_date)}</div><div className="card-actions"><Button variant="outline" onClick={() => { navigate('students'); setFilters({ ...EMPTY_FILTERS, batch: b.id }); }}>View students <ArrowUpRight /></Button>{canCore(data.me?.role) && <Button size="sm" disabled={!openForEnrollment} onClick={() => addStudentToBatch(b.id)}><Plus />{openForEnrollment ? 'Add student' : b.maximum_capacity != null && students.length >= b.maximum_capacity ? 'Batch full' : 'Enrollment closed'}</Button>}{canManage(data.me?.role) && <Button variant="ghost" size="icon" aria-label={`Edit ${b.batch_code}`} onClick={() => { setEditBatch(b); setDialog('batch'); }}><Pencil size={15}/></Button>}</div><Button className="club-batch-action" variant="ghost" size="sm" onClick={() => { navigate('clubs'); setClubBatch(b.id); }}><ClipboardList size={15}/> Club attendance</Button></article>; })}{!data.batches.length && <div className="form-card"><h2>No batches yet</h2><p className="help">{data.courses.length ? 'Create a batch before registering students.' : 'Create a course first, then add its batches.'}</p></div>}</div></>}
 {view === 'settings' && <><div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Settings & access</h1><p>Your institute, staff and connection.</p></div></div><section className="form-card"><h2><Database size={20}/> Database connection</h2><p className="help">{mode === 'demo' ? 'The interface is ready for review with sample data. Supabase configuration and initial administrator setup are required before adding real student records.' : 'Connected. Student records are saved to your institute’s Supabase database.'}</p><span className={'status-badge ' + (mode === 'ready' ? 'registered' : 'planning')}>{mode === 'ready' ? 'Connected' : 'Setup pending'}</span></section><section className="form-card"><div className="section-heading"><h2>Campuses</h2>{data.me?.role === 'super_admin' && <Button size="sm" variant="outline" onClick={() => setDialog('branch')}><Plus /> Add campus</Button>}</div>{data.branches.map(b => <div className="setting-row" key={b.id}><strong>{b.name}</strong><span>{b.code}</span><span className="status-badge active">{b.is_active ? 'Active' : 'Inactive'}</span></div>)}</section><section className="form-card"><h2>Staff access</h2><p className="help">Only the super administrator can change staff roles and campus access. New accounts require administrator activation.</p>{data.staff.map(s => <div className="setting-row" key={s.id}><div><strong>{s.full_name}</strong><p>{data.branches.find(b => b.id === s.branch_id)?.name || 'No campus assigned'}</p></div><span>{display(s.role)}</span><span className={'status-badge ' + (s.is_active ? 'active' : 'neutral')}>{s.is_active ? 'Active' : 'Pending'}</span>{data.me?.role === 'super_admin' && <Button size="sm" variant="outline" onClick={() => setStaffEdit(s)}>Edit access</Button>}</div>)}</section></>}
 </>}</div><footer className="app-footer"><span>HEXA’S Education</span><span>IELTS Student Desk</span></footer></SidebarInset><Toaster position="bottom-right"/>
 {dialog === 'course' && <CourseDialog course={editCourse} onClose={() => setDialog('')} mutate={mutate}/>} {dialog === 'batch' && <BatchDialog batch={editBatch} courseId={initialCourse} data={data} onClose={() => setDialog('')} mutate={mutate}/>} {dialog === 'branch' && <BranchDialog onClose={() => setDialog('')} mutate={mutate}/>}
 {reportRows && <ReportDialog students={reportRows} data={data} filters={reportLabels} demo={mode === 'demo'} onClose={() => setReportRows(null)}/>}{staffEdit && <StaffDialog staff={staffEdit} data={data} onClose={() => setStaffEdit(undefined)} mutate={mutate}/>}
 </SidebarProvider>;
}
function Stat({ label, value, note, icon: Icon, tone = '', onClick }: {
    label: string;
    value: number;
    note: string;
    icon: typeof Users;
    tone?: string;
    onClick: () => void;
}) { return <button className={'stat-card ' + tone} onClick={onClick}><div><span>{label}</span><Icon size={19}/></div><strong>{value.toString().padStart(2, '0')}</strong><p>{note}<ArrowUpRight size={15}/></p></button>; }
function Login({ onSuccess }: {
    onSuccess: () => Promise<void>;
}) { const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState(''), [signup, setSignup] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''); return <div className="login-page"><div className="login-card"><a className="brand" href="/"><span className="brand-mark">H<span /></span><span><strong>HEXA’S</strong><small>IELTS STUDENT DESK</small></span></a><h1>{signup ? 'Request staff access' : 'Welcome back'}</h1><p className="help">{signup ? 'Your administrator will activate your account and assign campus access.' : 'Sign in to your institute’s student workspace.'}</p><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    const c = api.getClient();
    if (!c)
        throw new Error('Database connection is unavailable.');
    if (signup) {
        const { error } = await c.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error)
            throw error;
        setMessage('Account requested. Check your email, then ask your administrator to activate access.');
    }
    else {
        const { error } = await c.auth.signInWithPassword({ email, password });
        if (error)
            throw error;
        await onSuccess();
    }
}
catch (e) {
    setError(e instanceof Error ? e.message : 'Sign in failed.');
}
finally {
    setBusy(false);
} }}>{signup && <Field label="Full name" required value={name} onChange={setName}/>}<Field label="Work email" required type="email" value={email} onChange={setEmail}/><Field label="Password" required type="password" value={password} onChange={setPassword}/>{error && <p role="alert" className="error-banner">{error}</p>}{message && <p className="success-banner">{message}</p>}<Button className="w-full" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Request access' : 'Sign in'}</Button></form><button className="text-button" onClick={() => { setSignup(!signup); setError(''); setMessage(''); }}>{signup ? 'Already have access? Sign in' : 'New staff member? Request access'}</button><p className="login-foot"><ShieldCheck size={14}/> Private institute workspace</p></div></div>; }
function BranchDialog({ onClose, mutate }: {
    onClose: () => void;
    mutate: (a: string, p: unknown) => Promise<void>;
}) { const [name, setName] = useState(''), [code, setCode] = useState(''); return <ActionDialog title="Add campus" onClose={onClose} onSave={async () => { if (!name.trim() || !code.trim())
    throw new Error('Campus name and code are required.'); await mutate('save_branch', { name, code: code.toUpperCase() }); }}><div className="form-grid"><Field label="Campus name" required value={name} onChange={setName}/><Field label="Campus code" required value={code} onChange={setCode}/></div></ActionDialog>; }
function StaffDialog({ staff, data, onClose, mutate }: {
    staff: Staff;
    data: Snapshot;
    onClose: () => void;
    mutate: (a: string, p: unknown) => Promise<void>;
}) { const [role, setRole] = useState(staff.role), [branch, setBranch] = useState(staff.branch_id || ''), [active, setActive] = useState(staff.is_active ? 'active' : 'inactive'); return <ActionDialog title={'Edit access · ' + staff.full_name} onClose={onClose} onSave={async () => { await mutate('save_staff', { id: staff.id, role, branch_id: branch || null, is_active: active === 'active' }); }}><div className="form-grid"><Pick label="Role" value={role} onChange={v => setRole(v as Staff['role'])} options={ROLES.map(value => ({ value, label: display(value) }))}/><Pick label="Campus" value={branch} onChange={setBranch} options={[{ value: '', label: 'No campus' }, ...data.branches.map(b => ({ value: b.id, label: b.name }))]}/><Pick label="Account status" value={active} onChange={setActive} options={['active', 'inactive'].map(value => ({ value, label: display(value) }))}/></div></ActionDialog>; }
