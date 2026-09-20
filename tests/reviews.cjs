const assert = require('node:assert/strict');
const { demoData } = require('../.tests-output/demo.js');
const { isHicuCourse, hicuEnrollments, reviewSchema, weeklyReviewSchema } = require('../.tests-output/model.js');
const { buildReport } = require('../.tests-output/report-definition.js');
const data = demoData();
const hicu = data.courses.find(c => c.id === 'hicu');
for (const name of ['HICU', 'CD-HICU', 'CD HICU', 'CD_HICU', 'cdhicu', 'IELTS HICU intensive']) {
  assert.equal(isHicuCourse({ ...hicu, name, short_code: 'INT' }), true, name);
}
for (const code of ['HICU', 'CD-HICU', 'CD HICU', 'cd_hicu']) {
  assert.equal(isHicuCourse({ ...hicu, name: 'Intensive care', short_code: code }), true, code);
}
for (const name of ['Spoken English', 'IELTS Premium', 'Computer-Based IELTS', 'HICUP', 'NONHICU']) {
  assert.equal(isHicuCourse({ ...hicu, name, short_code: 'OTHER' }), false, name);
}
assert.equal(isHicuCourse(undefined), false);
assert.equal(hicuEnrollments(data.students[0], data).length, 0);
assert.equal(hicuEnrollments(data.students[1], data).length, 1);
const renamed = { ...data, courses: data.courses.map(c => c.id === 'hicu' ? { ...c, name: 'Intensive care', short_code: 'IC' } : c) };
assert.equal(hicuEnrollments(data.students[1], renamed).length, 1, 'Historical monitoring remains visible after renaming');
const base = { category: 'star_student', expected_band: 6.5, module_states: { listening: 'on_track', reading: 'needs_attention', writing: 'critical', speaking: null } };
assert.equal(reviewSchema.safeParse(base).success, true);
assert.equal(reviewSchema.safeParse({ ...base, category: '' }).success, false);
assert.equal(reviewSchema.safeParse({ ...base, category: 'invalid' }).success, false);
for (const band of [-0.5, 6.3, 9.5]) assert.equal(reviewSchema.safeParse({ ...base, expected_band: band }).success, false);
for (const band of [null, 0, 9]) assert.equal(reviewSchema.safeParse({ ...base, expected_band: band }).success, true);
assert.equal(reviewSchema.safeParse({ ...base, module_states: { ...base.module_states, reading: 'star_student' } }).success, false);
const week = { ...base, enrollment_id: 'enrollment', week: 4, review_date: '2026-09-17', condition_notes: 'Improving.', discussion: 'Reviewed progress.', steps_taken: 'Continue.' };
assert.equal(weeklyReviewSchema.safeParse(week).success, true);
for (const value of [0, 1.5, 5]) assert.equal(weeklyReviewSchema.safeParse({ ...week, week: value }).success, false);
assert.equal(weeklyReviewSchema.safeParse({ ...week, review_date: '' }).success, false);
assert.equal(weeklyReviewSchema.safeParse({ ...week, discussion: 'x'.repeat(10001) }).success, false);
const report = JSON.stringify(buildReport([data.students[1]], data, [], true, 'Student review', true));
for (const value of ['Student review', 'Expected overall band', 'Week 1', 'Week 2', 'Meeting discussion', 'Steps taken / next steps', 'two extra care sessions']) assert.ok(report.includes(value), value);
const regularReport = JSON.stringify(buildReport([data.students[0]], data, [], true, 'Student review', true));
assert.equal(regularReport.includes('Weekly review:'), false);
console.log('PASS: course detection, historical visibility, review validation, and detailed PDF content.');
