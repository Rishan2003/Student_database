const assert = require('node:assert/strict');
const { parseClubText, matchClubRows, clubSelection, previousDay, validClubDate } = require('../.tests-output/club-model.js');
const base = { student_code: 'HEX-001', batch_id: 'b1', course_code: 'HICU', course_name: 'HICU', enrollment_status: 'active', enrollment_date: '2026-09-01' };
const roster = [
  { ...base, enrollment_id: 'e1', student_id: 's1', full_name: 'Md. Farhan Ahmed', batch_code: 'HICU-301' },
  { ...base, enrollment_id: 'e2', student_id: 's2', full_name: 'Ayesha Rahman', batch_code: 'HICU-301' },
  { ...base, enrollment_id: 'e3', student_id: 's3', full_name: 'Ayesha Rahman', batch_code: 'CD-301', batch_id: 'b2', course_code: 'CD' },
  { ...base, enrollment_id: 'e4', student_id: 's4', full_name: 'রাফি আহমেদ', batch_code: 'HICU-302' },
  { ...base, enrollment_id: 'e5', student_id: 's1', full_name: 'Md. Farhan Ahmed', batch_code: 'CD-299', batch_id: 'b3', course_code: 'CD' },
];
assert.deepEqual(parseClubText('Name | Batch\r\nMd. Farhan Ahmed | HICU-301\nরাফি আহমেদ\t৩০২'), [{ name: 'Md. Farhan Ahmed', batch: 'HICU-301' }, { name: 'রাফি আহমেদ', batch: '৩০২' }]);
assert.deepEqual(parseClubText('```json\n[{"name":"Farhan","batch":301}]\n```'), [{ name: 'Farhan', batch: '301' }]);
for (const bad of ['', 'Name | Batch', 'just a name', 'A | B | C', '{"attendees":[]}', '[{"name":7,"batch":301}]', '[{"name":"A","batch":-1}]', '[{"name":"A","batch":"301","extra":"ignore"}]', '[{"name":"A"}', 'x'.repeat(200001)]) assert.throws(() => parseClubText(bad));
assert.throws(() => parseClubText(JSON.stringify(Array.from({ length: 301 }, () => ({ name: 'A', batch: '1' })))), /300/);
const input = parseClubText('md farhan ahmed | HICU Batch 301\nAyesha Rahman | 301\nরাফি আহমেদ | ৩০২\nUnknown Student | 301\nMd. Farhan Ahmed | CD-299');
const matches = matchClubRows(input, roster);
assert.equal(matches[0].enrollmentId, 'e1');
assert.equal(matches[1].enrollmentId, '', 'Identical names in batches sharing a number must not be guessed.');
assert.equal(matches[2].enrollmentId, 'e4');
assert.equal(matches[3].enrollmentId, '');
assert.equal(matches[4].enrollmentId, 'e5');
assert.deepEqual(clubSelection(matches, roster), { ids: ['e1', 'e4'], unresolved: 2, skipped: 0, duplicates: 1 });
matches[1].enrollmentId = 'e2'; matches[3].enrollmentId = '__skip';
assert.deepEqual(clubSelection(matches, roster), { ids: ['e1', 'e2', 'e4'], unresolved: 0, skipped: 1, duplicates: 1 });
assert.equal(matchClubRows([{ name: 'Ayesha Rahman', batch: 'CD-301' }], roster)[0].enrollmentId, 'e3');
assert.equal(matchClubRows([{ name: 'Farhan Ahmed', batch: '301' }], roster)[0].enrollmentId, '', 'Do not guess a partially matching name.');
assert.equal(matchClubRows([{ name: 'Ayesha Rahman?', batch: 'CD-301' }], roster)[0].enrollmentId, '');
assert.equal(matchClubRows([{ name: 'Ayesha Rahman', batch: 'CD-301?' }], roster)[0].enrollmentId, '');
assert.equal(matchClubRows([{ name: '', batch: '301' }], roster)[0].enrollmentId, '');
assert.equal(matchClubRows([{ name: 'Md. Farhan Ahmed', batch: '' }], roster)[0].enrollmentId, '');
assert.equal(matchClubRows([{ name: 'Ayesha Rahman', batch: 'HICU-301' }], [...roster, { ...roster[1], enrollment_id: 'e6', student_id: 's6' }])[0].enrollmentId, '', 'Same-name students in one batch require a manual choice.');
assert.equal(previousDay('2026-03-01'), '2026-02-28');
assert.equal(previousDay('2024-03-01'), '2024-02-29');
assert.equal(validClubDate('2026-02-30'), false);
assert.equal(validClubDate('2100-01-01'), false);
assert.equal(validClubDate('2026-01-01'), true);
console.log('PASS: Club text/JSON parsing, Bengali digits, exact matching, uncertain names, same-name ambiguity, repeated students, explicit skips and calendar dates.');
