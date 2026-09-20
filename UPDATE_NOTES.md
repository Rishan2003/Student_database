# App updates: club attendance and student reviews

## Update your existing app

1. If you have **not installed the earlier student-review update**, run this file once in your **existing Supabase project's SQL Editor**:
   `supabase/migrations/20260917153650_student_reviews_and_hicu_weeks.sql`
   Skip this step if you have already applied it.
2. Run the new club attendance migration once in the same project:
   `supabase/migrations/20260920191342_club_attendance.sql`
3. Replace your application source with this version and redeploy the existing Vercel project. Keep the same Supabase environment variables.
4. Refresh the app. Select **Club attendance → Import club sheet**, or open **Batches → Club attendance** for a particular class.

**Run only migrations you have not already applied. Do not rerun the three original migrations or first-administrator setup on an existing installation.** Existing students, assessments, courses, notes, goals, accounts, enrollments and student reviews are retained.

For a fresh installation, follow VERCEL_SETUP.md and run all five migrations in filename order.

## New: daily club attendance

- Paste `Student name | Batch number` lines or a JSON array. Opening a `.txt` or `.json` file is also supported.
- Choose the campus, club module and date, check matched students, then save.
- Unclear matches require a manual choice or explicit skip. Duplicate students and repeated sheets are counted once.
- Open any batch and use Today, Yesterday or a selected date to check attendance in all four module clubs.
- Additional imports add to existing attendance. Incorrect entries can be removed individually and re-imported correctly.
- Club staff can match names across campus batches, while existing profile access remains in place.

**CLUB_ATTENDANCE.md** contains the daily workflow, text/JSON examples and a reusable prompt for extracting the photo with your preferred AI. Image recognition is external; the app imports the text. No additional environment variables or dependencies are required.

## Earlier update: student reviews

- **Every student:** a compact Student review card in Overview. Choose Star Student, On track, Needs attention or Critical. Set Listening, Reading, Writing and Speaking states, plus the overall IELTS band faculty expect. Leave irrelevant or unassessed fields unset. Existing module levels, estimated module bands and student targets stay in their usual places.
- **HICU and CD-HICU:** a Weekly review tab with Week 1–4. Each week holds a meeting date, category, module states, expected band, condition/behaviour, discussion and steps taken or next steps.
- A new week starts with the current review values as a draft. It is recorded only after **Save week**. Saving a week does not overwrite the current profile or other weeks.
- Students with multiple HICU enrollments have an enrollment selector. Each enrollment has its own four weeks, including completed enrollments.
- The existing **PDF → Detailed** report includes saved student reviews and weekly records.

Weekly monitoring recognizes HICU or CD-HICU in the course name or code, including common space/hyphen variations. Other courses do not receive the weekly tab. Historical monitoring remains visible if an HICU course is renamed.

Academic coordinators, branch managers, super administrators and assigned teachers can save reviews within their existing access. Other staff with student access can read them. Changes are logged, and a stale edit is rejected rather than overwriting another staff member's save.

This package contains the updated source and migration. It does not deploy to Vercel or run SQL against your live database automatically.

## Checks

```sh
npm ci
npm run build
npm run typecheck
npm run test:database
npm run test:reviews
npm run test:bootstrap
npm run test:config
npm run test:clubs
```

Database tests use isolated PostgreSQL and do not connect to your real student database.
