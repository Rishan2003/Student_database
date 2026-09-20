import { emptyCore, emptyGoal, emptyPlan, Snapshot, Student, REVIEW_CATEGORIES } from './model';
export function demoData(): Snapshot {
    const branches = [{ id: 'demo-branch', name: 'MajorTila', code: 'MT', is_active: true }];
    const staff = [{ id: 'demo-admin', full_name: 'Academic team', role: 'super_admin' as const, branch_id: 'demo-branch', is_active: true }];
    const courses = [['premium', 'IELTS Premium', 'IP', '90'], ['hicu', 'CD HICU', 'HICU', '30'], ['spoken', 'Spoken English', 'SE', '60'], ['computer', 'Computer-Based IELTS', 'CBI', '90']].map(([id, name, short_code, duration]) => ({ id, name, short_code, category: id === 'spoken' ? 'English' : 'IELTS', description: '', default_duration_days: +duration, is_active: true, ielts_tracking_enabled: id !== 'spoken' }));
    const batches = [['premium-301', 'premium', 'IP-301'], ['hicu-167', 'hicu', 'HICU-167'], ['spoken-143', 'spoken', 'SE-143'], ['computer-299', 'computer', 'CBI-299']].map(([id, course_type_id, batch_code]) => ({ id, course_type_id, batch_code, name: '', branch_id: 'demo-branch', teacher_id: 'demo-admin', start_date: '2026-09-01', end_date: '2026-11-30', class_days: ['Saturday', 'Monday', 'Wednesday'], start_time: '09:00', end_time: '11:00', room: 'Room 02', maximum_capacity: 25, status: 'running', notes: '' }));
    const names = ['Ayesha Rahman', 'Farhan Ahmed', 'Nusrat Jahan', 'Samiul Islam', 'Meherin Chowdhury', 'Tanvir Hasan', 'Sadia Akter', 'Raihan Mahmud'];
    const students: Student[] = names.map((name, i) => ({ ...emptyCore('demo-branch'), id: 'sample-' + i, student_code: 'DEMO-' + String(i + 1).padStart(3, '0'), full_name: name, primary_phone: '+88017000000' + String(i + 1).padStart(2, '0'), joining_date: '2026-09-01', education_level: 'HSC', created_at: '2026-09-01T09:00:00Z', updated_at: '2026-09-01T09:00:00Z', goal: { ...emptyGoal, target_overall: [7, 6.5, 7.5, 6, 7, 6.5, 7, 6.5][i], destination_country: ['United Kingdom', 'Canada', 'Australia', 'Finland', 'United Kingdom', 'Canada', 'Australia', 'Finland'][i], intended_intake: i % 2 ? '2027-09' : '2027-01' }, plan: { ...emptyPlan, registration_status: (['promised', 'registered', 'planning', 'not_planning'] as const)[i % 4], promised_registration_date: i % 4 === 0 ? '2026-09-08' : '', actual_registration_date: i % 4 === 1 ? '2026-09-05' : '', intended_exam_date: i % 4 === 3 ? '' : '2026-10-' + String(i + 10), actual_exam_date: i % 4 === 1 ? '2026-10-15' : '', provider: 'British Council' }, enrollments: [{ id: 'demo-e-' + i, student_id: 'sample-' + i, batch_id: batches[i % 4].id, enrollment_date: '2026-09-01', status: 'active', previous_hexus_student: false, previous_course_name: '', enrollment_notes: '' }], history: i % 3 === 0 ? [{ id: 'demo-h-' + i, student_id: 'sample-' + i, institution_type: 'external', institution_name: 'Previous institute (sample)', course_name: 'IELTS preparation', batch_name: '', completion_date: '2026-07-01', notes: '' }] : [], assessments: [{ id: 'demo-a-' + i, student_id: 'sample-' + i, enrollment_id: 'demo-e-' + i, levels: { listening: 3 + i % 3, reading: 2 + i % 3, writing: 2 + i % 2, speaking: 3 + i % 2 }, bands: { listening: null, reading: null, writing: null, speaking: null }, observation: i % 2 ? 'Speaking confidence is improving. Continue timed writing practice.' : 'Focus on Writing Task 2 structure and reading time management.', assessed_by: 'Academic team', created_at: '2026-09-09T09:00:00Z' }], notes: [] }));
    for (const [i, student] of students.entries()) {
        student.review = {
            student_id: student.id, category: REVIEW_CATEGORIES[i % 4], expected_band: i % 4 === 2 ? null : 6.5,
            module_states: { listening: 'on_track', reading: 'on_track', writing: i % 4 === 3 ? 'critical' : 'needs_attention', speaking: 'on_track' },
            updated_at: '2026-09-10T09:00:00Z', updated_by: 'demo-admin', author_name: 'Academic team',
        };
        student.weekly_reviews = i % 4 === 1 ? [1, 2].map(week => ({
            ...student.review!, id: `demo-week-${i}-${week}`, enrollment_id: student.enrollments[0].id, week,
            category: week === 1 ? 'needs_attention' : 'on_track', expected_band: week === 1 ? 6 : 6.5,
            module_states: { ...student.review!.module_states, writing: week === 1 ? 'critical' : 'needs_attention' },
            review_date: week === 1 ? '2026-09-03' : '2026-09-10',
            condition_notes: week === 1 ? 'Writing is below the expected level. Participates well in class.' : 'Writing structure is improving. Completed the extra practice.',
            discussion: week === 1 ? 'Faculty identified essay planning as the main gap.' : 'Reviewed the practice essays and progress since Week 1.',
            steps_taken: week === 1 ? 'Writing teacher arranged two extra care sessions before Week 2.' : 'Continue timed Task 2 practice. Review again in Week 3.',
            created_at: '2026-09-10T09:00:00Z',
        })) : [];
    }
    return { students, courses, batches, branches, staff, me: staff[0] };
}
