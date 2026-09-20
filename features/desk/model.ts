import { z } from 'zod';
export const MODULES = ['listening', 'reading', 'writing', 'speaking'] as const;
export type Module = typeof MODULES[number];
export const ROLES = ['super_admin', 'branch_manager', 'academic_coordinator', 'teacher', 'counselor', 'front_desk', 'viewer'] as const;
export type Role = typeof ROLES[number];
export const levelNames = ['Not assessed', '1 · Beginner', '2 · Developing', '3 · Intermediate', '4 · Proficient', '5 · IELTS ready'];
export const registrationNames: Record<string, string> = { not_planning: 'Not planning', planning: 'Planning', promised: 'Promised', registered: 'Registered' };
export const display = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase());
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const dateLabel = (s?: string | null) => s ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z')) : 'Not set';
export const intakeLabel = (s?: string | null) => s ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s.slice(0, 7) + '-01T12:00:00Z')) : 'Not set';
export const normalizePhone = (s: string) => { let n = s.replace(/[০-৯]/g, c => String('০১২৩৪৫৬৭৮৯'.indexOf(c))).replace(/[^\d+]/g, ''); if (n.startsWith('00880'))
    n = '+' + n.slice(2); if (/^01[3-9]\d{8}$/.test(n))
    n = '+88' + n; if (/^8801[3-9]\d{8}$/.test(n))
    n = '+' + n; return n; };
const text = z.string().trim().max(300), longText = z.string().trim().max(10000);
const optionalDate = z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))), 'Enter a valid date.');
const band = z.number().min(0).max(9).multipleOf(.5).nullable();
export const coreSchema = z.object({ full_name: text.min(2, 'Enter the student’s full name.'), primary_phone: text.transform(normalizePhone).refine(v => /^\+?\d{7,15}$/.test(v), 'Enter a valid phone number.'), whatsapp_phone: text.transform(normalizePhone).refine(v => !v || /^\+?\d{7,15}$/.test(v), 'Enter a valid WhatsApp number.'), secondary_phone: text.transform(normalizePhone).refine(v => !v || /^\+?\d{7,15}$/.test(v), 'Enter a valid secondary phone.'), email: z.union([z.literal(''), z.string().email()]), primary_branch_id: z.string().min(1, 'Choose a campus.'), status: z.enum(['active', 'inactive', 'completed', 'dropped', 'on_hold']), joining_date: optionalDate, education_level: text, institution_name: text, home_district: text, address: longText, general_notes: longText });
export const goalSchema = z.object({ target_overall: band, target_listening: band, target_reading: band, target_writing: band, target_speaking: band, destination_country: text, intended_intake: z.string().regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/), study_level: text, purpose: text, goal_notes: longText });
export const planSchema = z.object({ registration_status: z.enum(['not_planning', 'planning', 'promised', 'registered']), intended_exam_date: optionalDate, intended_exam_month: z.string(), promised_registration_date: optionalDate, actual_registration_date: optionalDate, actual_exam_date: optionalDate, provider: text, test_centre: text, candidate_reference: text, exam_type: text, exam_format: text, notes: longText }).superRefine((p, c) => { if (p.registration_status === 'registered' && !p.actual_registration_date)
    c.addIssue({ code: 'custom', path: ['actual_registration_date'], message: 'Enter the actual registration date.' }); if (p.registration_status === 'promised' && !p.promised_registration_date)
    c.addIssue({ code: 'custom', path: ['promised_registration_date'], message: 'Enter the promised registration date.' }); if (p.actual_registration_date && p.actual_exam_date && p.actual_registration_date > p.actual_exam_date)
    c.addIssue({ code: 'custom', path: ['actual_exam_date'], message: 'The exam date must be on or after registration.' }); });
export type Core = z.infer<typeof coreSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Levels = Record<Module, number | null>;
export type Bands = Record<Module, number | null>;
export const REVIEW_CATEGORIES = ['star_student', 'on_track', 'needs_attention', 'critical'] as const;
export type ReviewCategory = typeof REVIEW_CATEGORIES[number];
export const MODULE_STATES = ['on_track', 'needs_attention', 'critical'] as const;
export type ModuleState = typeof MODULE_STATES[number];
export type ModuleStates = Record<Module, ModuleState | null>;
export const emptyModuleStates: ModuleStates = { listening: null, reading: null, writing: null, speaking: null };
export const reviewNames: Record<ReviewCategory, string> = { star_student: 'Star Student', on_track: 'On track', needs_attention: 'Needs attention', critical: 'Critical' };
export const reviewSchema = z.object({
    category: z.enum(REVIEW_CATEGORIES, { errorMap: () => ({ message: 'Choose a student category.' }) }),
    expected_band: band,
    module_states: z.object({ listening: z.enum(MODULE_STATES).nullable(), reading: z.enum(MODULE_STATES).nullable(), writing: z.enum(MODULE_STATES).nullable(), speaking: z.enum(MODULE_STATES).nullable() }),
});
export type ReviewValues = z.infer<typeof reviewSchema>;
export type ReviewDraft = Omit<ReviewValues, 'category'> & { category: ReviewCategory | '' };
export interface StudentReview extends ReviewValues {
    student_id: string;
    updated_at: string;
    updated_by: string;
    author_name: string;
}
export const weeklyReviewSchema = reviewSchema.extend({
    enrollment_id: z.string().min(1, 'Choose an HICU enrollment.'),
    week: z.number().int().min(1).max(4),
    review_date: optionalDate.refine(v => !!v, 'Enter the meeting date.'),
    condition_notes: longText,
    discussion: longText,
    steps_taken: longText,
});
export interface WeeklyReview extends z.infer<typeof weeklyReviewSchema> {
    id: string;
    created_at: string;
    updated_at: string;
    updated_by: string;
    author_name: string;
}
export interface Branch {
    id: string;
    name: string;
    code: string;
    is_active: boolean;
}
export interface Course {
    id: string;
    name: string;
    short_code: string;
    category: string;
    description: string;
    default_duration_days: number | null;
    is_active: boolean;
    ielts_tracking_enabled: boolean;
}
export interface Batch {
    id: string;
    course_type_id: string;
    branch_id: string;
    batch_code: string;
    name: string;
    teacher_id: string | null;
    start_date: string;
    end_date: string;
    class_days: string[];
    start_time: string;
    end_time: string;
    room: string;
    maximum_capacity: number | null;
    status: string;
    notes: string;
}
export interface Enrollment {
    id: string;
    student_id: string;
    batch_id: string;
    enrollment_date: string;
    status: string;
    previous_hexus_student: boolean;
    previous_course_name: string;
    enrollment_notes: string;
}
export interface CourseHistory {
    id: string;
    student_id: string;
    institution_type: 'hexas' | 'external';
    institution_name: string;
    course_name: string;
    batch_name: string;
    completion_date: string;
    notes: string;
}
export interface Assessment {
    id: string;
    student_id: string;
    enrollment_id: string | null;
    levels: Levels;
    bands: Bands;
    observation: string;
    assessed_by: string;
    created_at: string;
}
export interface Note {
    id: string;
    student_id: string;
    category: string;
    note: string;
    author_id: string;
    author_name: string;
    created_at: string;
    visibility: string;
}
export interface Student extends Core {
    id: string;
    student_code: string;
    created_at: string;
    updated_at: string;
    goal: Goal;
    plan: Plan;
    enrollments: Enrollment[];
    history: CourseHistory[];
    assessments: Assessment[];
    notes: Note[];
    review?: StudentReview | null;
    weekly_reviews?: WeeklyReview[];
}
export interface Staff {
    id: string;
    full_name: string;
    role: Role;
    branch_id: string | null;
    is_active: boolean;
}
export interface Snapshot {
    students: Student[];
    courses: Course[];
    batches: Batch[];
    branches: Branch[];
    staff: Staff[];
    me: Staff | null;
}
export type View = 'students' | 'courses' | 'batches' | 'clubs' | 'reports' | 'settings';
export interface Filters {
    search: string;
    branch: string;
    course: string;
    batch: string;
    status: string;
    registration: string;
    module: string;
    level: string;
    country: string;
    intake: string;
    target: string;
    source: string;
    examFrom: string;
    examTo: string;
    registerFrom: string;
    registerTo: string;
    teacher: string;
    enrollment: string;
}
export const EMPTY_FILTERS: Filters = { search: '', branch: 'all', course: 'all', batch: 'all', status: 'all', registration: 'all', module: 'all', level: 'all', country: 'all', intake: '', target: 'all', source: 'all', examFrom: '', examTo: '', registerFrom: '', registerTo: '', teacher: 'all', enrollment: 'all' };
export const emptyGoal: Goal = { target_overall: null, target_listening: null, target_reading: null, target_writing: null, target_speaking: null, destination_country: '', intended_intake: '', study_level: '', purpose: '', goal_notes: '' };
export const emptyPlan: Plan = { registration_status: 'not_planning', intended_exam_date: '', intended_exam_month: '', promised_registration_date: '', actual_registration_date: '', actual_exam_date: '', provider: '', test_centre: '', candidate_reference: '', exam_type: 'IELTS Academic', exam_format: 'Computer', notes: '' };
export const emptyLevels: Levels = { listening: null, reading: null, writing: null, speaking: null };
export const emptyCore = (branch = ''): Core => ({ full_name: '', primary_phone: '', whatsapp_phone: '', secondary_phone: '', email: '', primary_branch_id: branch, status: 'active', joining_date: today(), education_level: '', institution_name: '', home_district: '', address: '', general_notes: '' });
export const latestAssessment = (s: Student) => s.assessments[0];
export const examDate = (s: Student) => s.plan.actual_exam_date || s.plan.intended_exam_date;
export const isOverdue = (s: Student, date = today()) => s.plan.registration_status !== 'registered' && !!s.plan.promised_registration_date && s.plan.promised_registration_date < date;
export const isUpcoming = (s: Student, days = 30, date = today()) => { const d = examDate(s); return !!d && d >= date && (Date.parse(d) - Date.parse(date)) / 86400000 <= days; };
export const hasInstituteHistory = (s: Student) => s.enrollments.length > 0 || s.history.some(h => h.institution_type === 'hexas');
export const canManage = (r?: Role) => !!r && ['super_admin', 'branch_manager', 'academic_coordinator'].includes(r);
export const canCore = (r?: Role) => canManage(r) || r === 'front_desk';
export const canAcademic = (r?: Role) => canManage(r) || r === 'teacher';
export const canIelts = (r?: Role) => canManage(r) || r === 'counselor';
// Match the course code, or HICU as a complete word in its name (including CD-HICU).
export const isHicuCourse = (course?: Course) => !!course && (
    ['HICU', 'CDHICU'].includes(course.short_code.toUpperCase().replace(/[^A-Z0-9]/g, '')) ||
    /(^|[^A-Z0-9])(?:CD[\s_-]*)?HICU($|[^A-Z0-9])/i.test(course.name)
);
export function hicuEnrollments(student: Student, data: Snapshot) {
    return student.enrollments.filter(e => {
        const batch = data.batches.find(b => b.id === e.batch_id);
        return isHicuCourse(data.courses.find(c => c.id === batch?.course_type_id)) ||
            (student.weekly_reviews || []).some(r => r.enrollment_id === e.id);
    });
}
export function filterStudents(students: Student[], f: Filters, batches: Batch[]): Student[] {
    const q = f.search.toLocaleLowerCase().trim(), digits = normalizePhone(q);
    return students.filter(s => {
        const own = s.enrollments.map(e => ({ e, b: batches.find(b => b.id === e.batch_id) }));
        if (q && !([s.full_name, s.student_code, s.primary_phone, s.whatsapp_phone, s.secondary_phone, s.email, ...own.map(x => x.b?.batch_code || '')].some(x => x.toLocaleLowerCase().includes(q)) || (digits.length > 3 && [s.primary_phone, s.whatsapp_phone, s.secondary_phone].some(p => normalizePhone(p).includes(digits)))))
            return false;
        if (f.branch !== 'all' && s.primary_branch_id !== f.branch && !own.some(x => x.b?.branch_id === f.branch))
            return false;
        if (f.course !== 'all' || f.batch !== 'all' || f.teacher !== 'all' || f.enrollment !== 'all')
            if (!own.some(({ e, b }) => (f.course === 'all' || b?.course_type_id === f.course) && (f.batch === 'all' || e.batch_id === f.batch) && (f.teacher === 'all' || b?.teacher_id === f.teacher) && (f.enrollment === 'all' || e.status === f.enrollment)))
                return false;
        if (f.status !== 'all' && s.status !== f.status)
            return false;
        if (f.registration === 'not_registered' && s.plan.registration_status === 'registered')
            return false;
        if (f.registration === 'overdue' && !isOverdue(s))
            return false;
        if (!['all', 'not_registered', 'overdue'].includes(f.registration) && s.plan.registration_status !== f.registration)
            return false;
        const ls = latestAssessment(s)?.levels;
        if (f.level !== 'all') {
            const mods = f.module === 'all' ? MODULES : [f.module as Module];
            if (f.level === 'unassessed' ? !mods.some(m => ls?.[m] == null) : !mods.some(m => ls?.[m] === Number(f.level)))
                return false;
        }
        if (f.country !== 'all' && s.goal.destination_country !== f.country)
            return false;
        if (f.intake && s.goal.intended_intake !== f.intake)
            return false;
        if (f.target !== 'all' && s.goal.target_overall !== Number(f.target))
            return false;
        if (f.source === 'hexas' && !hasInstituteHistory(s))
            return false;
        if (f.source === 'external' && !s.history.some(h => h.institution_type === 'external'))
            return false;
        if (f.source === 'new' && (hasInstituteHistory(s) || s.history.length > 0))
            return false;
        const ed = examDate(s), rd = s.plan.actual_registration_date || s.plan.promised_registration_date;
        if (f.examFrom && (!ed || ed < f.examFrom) || f.examTo && (!ed || ed > f.examTo))
            return false;
        if (f.registerFrom && (!rd || rd < f.registerFrom) || f.registerTo && (!rd || rd > f.registerTo))
            return false;
        return true;
    });
}
export function filterLabels(f: Filters, d: Snapshot): string[] { const labels: string[] = []; const map: Record<string, string> = { search: 'Search', branch: 'Campus', course: 'Course', batch: 'Batch', status: 'Status', registration: 'Registration', module: 'Module', level: 'Level', country: 'Country', intake: 'Intake', target: 'Target band', source: 'Course history', examFrom: 'Exam from', examTo: 'Exam until', registerFrom: 'Registration from', registerTo: 'Registration until', teacher: 'Teacher', enrollment: 'Enrollment' }; for (const [k, v] of Object.entries(f)) {
    if (!v || v === 'all')
        continue;
    let value = v;
    if (k === 'branch')
        value = d.branches.find(x => x.id === v)?.name || v;
    if (k === 'course')
        value = d.courses.find(x => x.id === v)?.name || v;
    if (k === 'batch')
        value = d.batches.find(x => x.id === v)?.batch_code || v;
    if (k === 'teacher')
        value = d.staff.find(x => x.id === v)?.full_name || v;
    if (k === 'registration')
        value = registrationNames[v] || display(v);
    if (k === 'intake')
        value = intakeLabel(v);
    labels.push(`${map[k]}: ${value}`);
} return labels; }
export function duplicates(core: Core, students: Student[], except?: string) { const phones = [core.primary_phone, core.whatsapp_phone, core.secondary_phone].map(normalizePhone).filter(Boolean); return students.filter(s => s.id !== except && ([s.primary_phone, s.whatsapp_phone, s.secondary_phone].map(normalizePhone).some(p => p && phones.includes(p)) || (core.email && s.email.toLowerCase() === core.email.toLowerCase()))); }
