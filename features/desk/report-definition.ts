import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Student, Snapshot, MODULES, display, dateLabel, intakeLabel, examDate, registrationNames, isOverdue, hasInstituteHistory } from './model';
import { reviewNames } from './model';
function rich(value: unknown): ContentText { const s = value == null || value === '' ? '—' : String(value); return { text: (s.match(/[\u0964-\u0965\u0980-\u09ff\u200c\u200d]+|[^\u0964-\u0965\u0980-\u09ff\u200c\u200d]+/g) || ['—']).map(t => ({ text: t, font: /[\u0964-\u0965\u0980-\u09ff]/.test(t) ? 'Bengali' : 'Inter' })) }; }
export function buildReport(students: Student[], data: Snapshot, filters: string[], details: boolean, title: string, demo = false): TDocumentDefinitions {
    const rows: Content[] = [{ text: 'HEXA’S  /  IELTS STUDENT DESK', fontSize: 10, bold: true, color: '#223c7b', margin: [0, 0, 0, 12] }, { ...rich(title || 'Student report'), fontSize: 24, bold: true, margin: [0, 0, 0, 6] }, rich(`${students.length} student${students.length === 1 ? '' : 's'}  ·  Generated ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Asia/Dhaka' }).format(new Date())}`), { text: demo ? 'SAMPLE DATA — for preview only' : 'Confidential · Internal academic use', fontSize: 9, color: demo ? '#aa3e29' : '#65738b', margin: [0, 5, 0, 12] }, rich('Filters: ' + (filters.join('  |  ') || 'All students')), { text: ' ', margin: [0, 0, 0, 5] }];
    if (!details) {
        rows.push({ table: { headerRows: 1, dontBreakRows: true, widths: [130, 104, 72, 35, 92, 89, '*'], body: [['Student / phone', 'Course / batch', 'Levels L R W S', 'Target', 'Destination / intake', 'Main test', 'Registration'].map(t => ({ text: t, bold: true, color: '#ffffff', fillColor: '#13234a', fontSize: 9 })), ...students.map(s => { const enroll = s.enrollments.filter(e => ['active', 'enrolled'].includes(e.status)); const list = enroll.length ? enroll : s.enrollments; return [rich(`${s.full_name}\n${s.student_code}\n${s.primary_phone}`), rich(list.map(e => { const b = data.batches.find(b => b.id === e.batch_id); return `${data.courses.find(c => c.id === b?.course_type_id)?.name || 'Previous course'} · ${b?.batch_code || ''}`; }).join('\n') || 'No enrollment'), rich(MODULES.map(m => s.assessments[0]?.levels[m] ?? '—').join('   ') + '\nStaff scale 1–5'), rich(s.goal.target_overall?.toFixed(1)), rich(`${s.goal.destination_country || 'Not set'}\n${intakeLabel(s.goal.intended_intake)}`), rich(`${examDate(s) ? dateLabel(examDate(s)) : s.plan.intended_exam_month ? intakeLabel(s.plan.intended_exam_month) : 'Not planned'}\n${s.plan.actual_exam_date ? 'Confirmed' : examDate(s) || s.plan.intended_exam_month ? 'Intended' : ''}`), rich(`${isOverdue(s) ? 'OVERDUE · ' : ''}${registrationNames[s.plan.registration_status]}\n${s.plan.registration_status === 'registered' ? dateLabel(s.plan.actual_registration_date) : s.plan.promised_registration_date ? 'Due ' + dateLabel(s.plan.promised_registration_date) : ''}`)]; })] }, layout: { fillColor: (i: number) => i > 0 && i % 2 === 0 ? '#f2f5fa' : null, hLineColor: () => '#e0e6f0', vLineWidth: () => 0, paddingTop: () => 9, paddingBottom: () => 9, paddingLeft: () => 7, paddingRight: () => 7 }, fontSize: 8.5 });
    }
    else
        students.forEach((s, index) => {
            rows.push({ ...rich(s.full_name), fontSize: 20, bold: true, pageBreak: index === 0 ? undefined : 'before', margin: [0, 15, 0, 5] }, rich(`${s.student_code} · ${s.primary_phone}`));
            const section = (label: string, pairs: [
                string,
                unknown
            ][]) => { rows.push({ text: label, bold: true, fontSize: 12, color: '#223c7b', margin: [0, 16, 0, 7] }, { table: { widths: [145, '*'], body: pairs.map(([l, v]) => [{ text: l, color: '#65738b' }, rich(v)]) }, layout: 'lightHorizontalLines', fontSize: 10 }); };
            section('Personal details', [['Campus', data.branches.find(b => b.id === s.primary_branch_id)?.name], ['Status', display(s.status)], ['Joining date', dateLabel(s.joining_date)], ['WhatsApp', s.whatsapp_phone], ['Secondary phone', s.secondary_phone], ['Email', s.email], ['Education', s.education_level], ['Institution', s.institution_name], ['District', s.home_district], ['Address', s.address], ['Institute student', hasInstituteHistory(s) ? 'Yes' : 'No recorded HEXA’S course'], ['General notes', s.general_notes]]);
            section('IELTS goals', [['Overall target', s.goal.target_overall], ...MODULES.map(m => [display(m) + ' target', s.goal[`target_${m}`]] as [
                    string,
                    unknown
                ]), ['Destination', s.goal.destination_country], ['Intake', intakeLabel(s.goal.intended_intake)], ['Study level', s.goal.study_level], ['Purpose', s.goal.purpose], ['Notes', s.goal.goal_notes]]);
            section('Exam & registration', [['Registration', registrationNames[s.plan.registration_status] + (isOverdue(s) ? ' — overdue' : '')], ['Intended exam date', dateLabel(s.plan.intended_exam_date)], ['Intended exam month', intakeLabel(s.plan.intended_exam_month)], ['Promised registration', dateLabel(s.plan.promised_registration_date)], ['Actual registration', dateLabel(s.plan.actual_registration_date)], ['Confirmed exam date', dateLabel(s.plan.actual_exam_date)], ['Exam type', s.plan.exam_type], ['Format', s.plan.exam_format], ['Provider', s.plan.provider], ['Test centre', s.plan.test_centre], ['Candidate reference', s.plan.candidate_reference], ['Notes', s.plan.notes]]);
            section('Course enrollments', s.enrollments.length ? s.enrollments.map(e => { const b = data.batches.find(b => b.id === e.batch_id); return [b?.batch_code || 'Previous batch', `${data.courses.find(c => c.id === b?.course_type_id)?.name || 'Previous course'} · ${display(e.status)} · ${dateLabel(e.enrollment_date)}\n${e.enrollment_notes}`] as [
                string,
                unknown
            ]; }) : [['Enrollments', 'None recorded']]);
            section('Previous courses & institutes', s.history.length ? s.history.map(h => [h.institution_type === 'hexas' ? 'HEXA’S' : 'External institute', `${h.institution_name} · ${h.course_name}\n${h.batch_name} ${h.completion_date ? dateLabel(h.completion_date) : ''}\n${h.notes}`]) : [['History', 'None recorded']]);
            section('Module assessments & teacher observations', s.assessments.length ? s.assessments.map(a => [`${dateLabel(a.created_at.slice(0, 10))}\n${a.assessed_by}`, MODULES.map(m => `${display(m)}: level ${a.levels[m] ?? '—'}/5 · estimated band ${a.bands[m]?.toFixed(1) || '—'}`).join('\n') + '\n' + a.observation]) : [['Assessment', 'Not assessed']]);
            if (s.review) section('Student review', [
                ['Category', reviewNames[s.review.category]], ['Expected overall band', s.review.expected_band?.toFixed(1) ?? 'Not set'],
                ...MODULES.map(m => [display(m), s.review!.module_states[m] ? reviewNames[s.review!.module_states[m]!] : 'Not assessed'] as [string, unknown]),
            ]);
            for (const week of [...(s.weekly_reviews || [])].sort((a, b) => a.enrollment_id.localeCompare(b.enrollment_id) || a.week - b.week)) {
                const enrollment = s.enrollments.find(e => e.id === week.enrollment_id);
                const batch = data.batches.find(b => b.id === enrollment?.batch_id);
                section(`Weekly review: ${batch?.batch_code || 'HICU'} / Week ${week.week}`, [
                    ['Meeting date', dateLabel(week.review_date)], ['Category', reviewNames[week.category]],
                    ['Expected overall band', week.expected_band?.toFixed(1) ?? 'Not set'],
                    ...MODULES.map(m => [display(m), week.module_states[m] ? reviewNames[week.module_states[m]!] : 'Not assessed'] as [string, unknown]),
                    ['Condition & behaviour', week.condition_notes], ['Meeting discussion', week.discussion],
                    ['Steps taken / next steps', week.steps_taken], ['Recorded by', week.author_name],
                ]);
            }
            section('Student notes', s.notes.length ? s.notes.map(n => [`${display(n.category)}\n${n.author_name}\n${dateLabel(n.created_at.slice(0, 10))}`, n.note]) : [['Notes', 'None recorded']]);
        });
    return { info: { title: title || 'Student report', author: 'HEXA’S' }, pageSize: 'A4', pageOrientation: details ? 'portrait' : 'landscape', pageMargins: [30, 30, 30, 40], defaultStyle: { font: 'Inter', fontSize: 10, color: '#182542' }, content: rows, footer: (current, total) => ({ text: `HEXA’S · ${demo ? 'SAMPLE DATA' : 'Confidential'}                      Page ${current} of ${total}`, fontSize: 8, color: '#65738b', alignment: 'center', margin: [30, 12, 30, 0] }) };
}
