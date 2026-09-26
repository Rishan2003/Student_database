import { MODULES, canAcademic, today, type Module, type Role, type Snapshot } from './model';

export interface ClubRosterRow {
    enrollment_id: string;
    student_id: string;
    full_name: string;
    student_code: string;
    batch_id: string;
    batch_code: string;
    course_code: string;
    course_name: string;
    enrollment_date: string;
    enrollment_status: string;
}
export interface ClubSession { id: string; branch_id: string; club_date: string; module: Module; }
export interface ClubEntry { id: string; session_id: string; student_id: string; enrollment_id: string; created_at: string; }
export interface ClubDay { sessions: ClubSession[]; attendance: ClubEntry[]; }
export interface ClubInputRow { name: string; batch: string; }
export interface ClubSuggestion { enrollmentId: string; reason: string; score: number; }
export interface ClubMatch extends ClubInputRow { enrollmentId: string; reason: string; suggestions?: ClubSuggestion[]; }
export const canRecordClubs = (role?: Role) => canAcademic(role) || role === 'front_desk';
export const previousDay = (date = today()) => new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
export const validClubDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date && date <= today();
const digits = (s: string) => s.normalize('NFKC').replace(/[০-৯]/g, c => String('০১২৩৪৫৬৭৮৯'.indexOf(c)));
const nameKey = (s: string) => digits(s).toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
// Normalize formatting while retaining all numeric groups and course information.
const batchParts = (s: string) => {
    const tokens = digits(s).toLocaleLowerCase().replace(/\b(batch|number|no|code)\b/g, '').match(/[\p{L}\p{M}]+|\d+/gu) || [];
    return { course: tokens.filter(t => !/^\d+$/.test(t)).join(''), numbers: tokens.filter(t => /^\d+$/.test(t)).map(t => t.replace(/^0+(?=\d)/, '')).join(':') };
};
function batchStrength(input: ReturnType<typeof batchParts>, row: ClubRosterRow) {
    const stored = batchParts(row.batch_code);
    if (!input.numbers || input.numbers !== stored.numbers) return 0;
    const course = batchParts(row.course_code).course, fullCourse = batchParts(row.course_name).course;
    if (!input.course || [stored.course, course + stored.course, fullCourse + stored.course,
        ...(!stored.course || stored.course === course ? [course, fullCourse] : [])].includes(input.course)) return 2;
    return 1; // Same number, different course: suggestion only.
}
const titles = new Set(['md', 'mohammad', 'mohammed', 'muhammad', 'mr', 'mrs', 'ms', 'মো', 'মোহাম্মদ']);
const nameWords = (name: string) => nameKey(name).split(' ').filter(w => w && !titles.has(w));
function nameMatches(input: string, fullName: string) {
    const words = nameWords(input), remaining = nameWords(fullName);
    if (!words.length || !words.some(w => [...w].length > 1)) return false;
    // Distinct complete words may be reordered or omit middle names.
    return words.every(w => { const index = remaining.indexOf(w); if (index < 0) return false; remaining.splice(index, 1); return true; });
}
function similarity(a: string, b: string) {
    const left = [...a], right = [...b];
    let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    for (let i = 0; i < left.length; i++) {
        const current = [i + 1];
        for (let j = 0; j < right.length; j++) current.push(Math.min(current[j] + 1, previous[j + 1] + 1, previous[j] + (left[i] === right[j] ? 0 : 1)));
        previous = current;
    }
    return 1 - previous[right.length] / Math.max(left.length, right.length, 1);
}
function nameSimilarity(input: string, fullName: string) {
    const words = nameWords(input), full = nameWords(fullName);
    if (!words.length || !full.length || !words.some(w => [...w].length > 1)) return 0;
    // Suggestions also accommodate initials, joined names and modest spelling differences.
    const available = [...full];
    let total = 0;
    for (const word of [...words].sort((a, b) => b.length - a.length)) {
        const scored = available.map((candidate, index) => ({ index, score: word.length === 1 && candidate.startsWith(word) ? 0.8 : similarity(word, candidate) })).sort((a, b) => b.score - a.score);
        if (scored[0]) { total += scored[0].score; available.splice(scored[0].index, 1); }
    }
    return Math.max(total / words.length, similarity(words.join(''), full.join('')));
}

export const CLUB_AI_PROMPT = `Read this club attendance sheet. Transcribe every student row in the same order. Return ONLY a JSON array in this format:
[{"name":"Student full name","batch":"Batch code or number"}]
Copy names and batch codes exactly as written, including course prefixes. Do not guess, correct spelling, add students, or merge similar names. Use an empty string for an unreadable name or batch so I can check it. Exclude headings, dates, signatures and serial numbers. Do not include explanations or markdown.`;

export function parseClubText(input: string): ClubInputRow[] {
    if (input.length > 200000) throw new Error('Use a sheet smaller than 200,000 characters.');
    const source = input.replace(/^\uFEFF/, '').trim().replace(/^```(?:json|text)?\s*\n([\s\S]*?)\n```$/i, '$1').trim();
    if (!source) throw new Error('Paste the names and batches first.');
    let rows: unknown[];
    if (source.startsWith('[') || source.startsWith('{')) {
        let parsed: unknown;
        try { parsed = JSON.parse(source); } catch { throw new Error('The JSON is incomplete. Paste the full array, or use one Name | Batch per line.'); }
        if (!Array.isArray(parsed)) throw new Error('Use a JSON array of {"name":"…","batch":"…"} rows. Choose the club and date in this form.');
        rows = parsed;
    } else {
        rows = source.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
            const parts = line.split(line.includes('|') ? '|' : '\t').map(s => s.trim());
            if (parts.length !== 2) throw new Error(`Line ${i + 1}: use Student name | Batch number.`);
            return { name: parts[0], batch: parts[1] };
        });
        const first = rows[0] as ClubInputRow;
        if (first && /^(student\s+)?name$/i.test(first.name) && /^batch(\s+(number|code))?$/i.test(first.batch)) rows.shift();
    }
    if (!rows.length || rows.length > 300) throw new Error('Import between 1 and 300 student rows at a time.');
    return rows.map((row, i) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Row ${i + 1}: enter a name and batch.`);
        const value = row as Record<string, unknown>;
        if (Object.keys(value).some(key => !['name', 'batch'].includes(key))) throw new Error(`Row ${i + 1}: use only the name and batch fields.`);
        const name = value.name ?? '', batch = value.batch ?? '';
        if (typeof name !== 'string' || !(typeof batch === 'string' || typeof batch === 'number' && Number.isSafeInteger(batch) && batch >= 0)) throw new Error(`Row ${i + 1}: the name must be text and the batch must be text or a whole number.`);
        if (name.length > 300 || String(batch).length > 150) throw new Error(`Row ${i + 1} is too long. Check the name and batch.`);
        return { name: name.trim(), batch: String(batch).trim() };
    });
}

export function matchClubRows(rows: ClubInputRow[], roster: ClubRosterRow[]): ClubMatch[] {
    return rows.map(row => {
        const unclear = /[?\[\]]/.test(row.name + row.batch) || /\b(unclear|unreadable)\b/i.test(row.name + ' ' + row.batch);
        const name = nameKey(row.name), batch = batchParts(row.batch);
        const ranked = roster.map(r => ({ record: r, batch: batchStrength(batch, r), exact: nameMatches(name, r.full_name), similarity: nameSimilarity(name, r.full_name) }));
        const matches = ranked.filter(r => r.batch === 2 && r.exact);
        const suggestions = ranked.filter(r => r.exact || r.similarity >= (r.batch ? 0.6 : 0.8))
            .map(r => ({ enrollmentId: r.record.enrollment_id, score: r.similarity + r.batch * 2,
                reason: r.batch === 2 ? (r.exact ? 'Name and batch match' : 'Similar name · batch matches') : r.batch === 1 ? 'Batch number matches · check course and name' : 'Name resembles this student · check batch' }))
            .sort((a, b) => b.score - a.score || a.enrollmentId.localeCompare(b.enrollmentId)).slice(0, 5);
        const selected = !unclear && matches.length === 1 ? matches[0].record : undefined;
        return { ...row, enrollmentId: selected?.enrollment_id || '', suggestions,
            reason: unclear ? 'Unclear text — choose the student' : selected ? (nameKey(selected.full_name) === name ? 'Matched' : 'Short or reordered name matched — check full name') : matches.length > 1 ? 'More than one match — choose the student' : suggestions.length ? 'Possible matches — choose the correct student' : 'No close match — search or edit this row' };
    });
}

export function clubSelection(rows: ClubMatch[], roster: ClubRosterRow[]) {
    const ids: string[] = [], students = new Set<string>();
    let unresolved = 0, skipped = 0, duplicates = 0;
    for (const row of rows) {
        if (row.enrollmentId === '__skip') { skipped++; continue; }
        const record = roster.find(r => r.enrollment_id === row.enrollmentId);
        if (!record) { unresolved++; continue; }
        if (students.has(record.student_id)) { duplicates++; continue; }
        students.add(record.student_id); ids.push(record.enrollment_id);
    }
    return { ids, unresolved, skipped, duplicates };
}

export function sampleClubRoster(data: Snapshot, branch: string, date: string): ClubRosterRow[] {
    return data.students.flatMap(s => s.enrollments.flatMap(e => {
        const batch = data.batches.find(b => b.id === e.batch_id && b.branch_id === branch);
        if (!batch || e.enrollment_date > date) return [];
        const course = data.courses.find(c => c.id === batch.course_type_id);
        return [{ enrollment_id: e.id, student_id: s.id, full_name: s.full_name, student_code: s.student_code, batch_id: batch.id, batch_code: batch.batch_code, course_code: course?.short_code || '', course_name: course?.name || '', enrollment_date: e.enrollment_date, enrollment_status: e.status }];
    }));
}
export function sampleClubDay(data: Snapshot, branch: string, date: string): ClubDay {
    const roster = sampleClubRoster(data, branch, date);
    const sessions = MODULES.filter(m => ['speaking', 'writing'].includes(m)).map(module => ({ id: 'sample-club-' + module, branch_id: branch, club_date: date, module }));
    return { sessions, attendance: roster.filter((_, i) => i % 2 === 0).map((r, i) => ({ id: 'sample-attendance-' + i, session_id: sessions[i % 2].id, student_id: r.student_id, enrollment_id: r.enrollment_id, created_at: date + 'T10:00:00Z' })) };
}
