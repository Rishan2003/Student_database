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
assert.equal(matchClubRows([{ name: 'Farhan Ahmed', batch: '301' }], roster)[0].enrollmentId, 'e1', 'A unique shortened name in the batch is supported.');
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

const preRoster = [
  { ...base, enrollment_id: 'p1', student_id: 'ps1', full_name: 'Rafi Ahmed', batch_code: 'PRE-122', course_code: 'PRE' },
  { ...base, enrollment_id: 'p2', student_id: 'ps2', full_name: 'Rafi Hasan', batch_code: 'REG-122', course_code: 'REG', batch_id: 'b2' },
];
const match = (name, batch, list = preRoster) => matchClubRows([{ name, batch }], list)[0];
for (const batch of ['PRE-122', '122 (pre)', 'pre 122', '122pre', 'PRE / ১২২', 'Batch 122 PRE', 'PRE_122']) {
  assert.equal(match('Rafi', batch).enrollmentId, 'p1', batch);
}
assert.equal(match('Rafi', '122').enrollmentId, '', 'Number-only batch cannot resolve two Rafis across courses.');
assert.equal(match('Rafi Ahmed', '122').enrollmentId, 'p1');
assert.equal(match('Rafi', 'XYZ-122').enrollmentId, '', 'Do not ignore an explicit unknown prefix.');
assert.equal(match('Raf', 'PRE-122').enrollmentId, '', 'No substring or spelling guesses.');
assert.equal(match('Rafi', 'PRE-12-2').enrollmentId, '', 'Distinct number groups must not collapse.');
assert.equal(match('Rafi', 'PRE').enrollmentId, '', 'A course alone is not a batch.');
assert.equal(match('Rafi', 'PRE-122', [...preRoster, { ...preRoster[0], full_name: 'Rafi Islam', enrollment_id: 'p3', student_id: 'ps3' }]).enrollmentId, '');
assert.equal(match('Rafi', 'PRE-122', [...preRoster, { ...preRoster[0], full_name: 'Rafi', enrollment_id: 'p3', student_id: 'ps3' }]).enrollmentId, '', 'An exact short name must not hide another possible student.');
assert.equal(match('Rafi', '122 (pre)', [{ ...preRoster[0], batch_code: '122' }]).enrollmentId, 'p1', 'Course prefix can come from the course field.');
assert.equal(match('Rafi', 'PRE-122', [{ ...preRoster[0], batch_code: '122 (PRE)' }]).enrollmentId, 'p1', 'Stored batch codes normalize too.');
assert.equal(matchClubRows([{ name: 'Farhan', batch: '301' }], roster)[0].enrollmentId, 'e1');
assert.equal(matchClubRows([{ name: 'Md.', batch: '301' }], roster)[0].enrollmentId, '');
assert.equal(matchClubRows([{ name: 'রাফি', batch: '৩০২' }], roster)[0].enrollmentId, 'e4');
assert.equal(match('Rafi', 'PRE-122', [...preRoster, { ...preRoster[0], enrollment_id: 'p3' }]).enrollmentId, '', 'Multiple enrollments need an explicit choice.');
assert.match(match('Rafi', 'PRE-122').reason, /Short name/);
console.log('PASS: Short names, reordered batch codes, explicit prefixes, Bengali names/digits, and ambiguous enrollments.');
