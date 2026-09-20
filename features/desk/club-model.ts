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
export interface ClubMatch extends ClubInputRow { enrollmentId: string; reason: string; }
export const canRecordClubs = (role?: Role) => canAcademic(role) || role === 'front_desk';
export const previousDay = (date = today()) => new Date(Date.parse(date + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
export const validClubDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date && date <= today();
const digits = (s: string) => s.normalize('NFKC').replace(/[০-৯]/g, c => String('০১২৩৪৫৬৭৮৯'.indexOf(c)));
const nameKey = (s: string) => digits(s).toLocaleLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
const batchKey = (s: string) => digits(s).toLocaleLowerCase().replace(/\bbatch\b/g, '').replace(/[^\p{L}\p{N}]/gu, '');

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
        if (/[?\[\]]/.test(row.name + row.batch) || /\b(unclear|unreadable)\b/i.test(row.name + ' ' + row.batch)) return { ...row, enrollmentId: '', reason: 'Unclear text — choose the student' };
        const name = nameKey(row.name), batch = batchKey(row.batch);
        const batches = roster.filter(r => batch && (batchKey(r.batch_code) === batch || batchKey(r.course_code + ' ' + r.batch_code) === batch ||
            /^\d+$/.test(batch) && digits(r.batch_code).match(/\d+\s*$/)?.[0].trim() === batch));
        const matches = batches.filter(r => name && nameKey(r.full_name) === name);
        return { ...row, enrollmentId: matches.length === 1 ? matches[0].enrollment_id : '', reason: matches.length === 1 ? 'Matched' : matches.length > 1 ? 'More than one match — choose the student' : !batches.length ? 'Batch not matched — choose the student' : 'Name not matched — choose the student' };
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
