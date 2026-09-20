# HEXA’S IELTS Student Desk — Vercel edition

Downloadable source for the student database application. This edition uses standard Next.js with Supabase Auth and PostgreSQL, and is configured for Vercel.

**Start with [VERCEL_SETUP.md](./VERCEL_SETUP.md).** It explains deployment, connecting the database, and activating your administrator account.

**Updating an existing installation?** Read [UPDATE_NOTES.md](./UPDATE_NOTES.md) for club attendance, student reviews and the migrations needed for your version.

## Included

- Batch-first registration: create a course and batch, then register students directly inside that batch.
- Course types and batches, with teachers, schedules and capacity.
- Daily club attendance: paste AI-extracted names and batches, check matches, and view attendance by batch and date. See [CLUB_ATTENDANCE.md](./CLUB_ATTENDANCE.md).
- Student names, contact details, campus and permanent student IDs.
- Listening, Reading, Writing and Speaking levels; estimated bands and assessment history.
- Target scores, country, intake, planned test dates, registration promises and registration confirmation.
- Multiple institute enrollments and previous courses at other institutes.
- Teacher observations and role-controlled notes.
- Student category, current module states and faculty's expected overall band.
- Four separate weekly meeting records per HICU/CD-HICU enrollment, included in detailed PDF reports.
- Combined student filters and PDF export of every matching student, including results beyond the current table page.
- Summary and detailed PDF layouts with English and Bengali fonts.
- Supabase sign-in, staff roles, campus access, database rules and audit history.

## Activation status

The ZIP contains the application and database setup files. It does not contain a Supabase database, credentials, real student records, or an administrator password.

Without Supabase environment variables, the app opens in a clearly labeled, read-only sample mode. Real student saving becomes available after completing database and administrator setup. Uploading the app to Vercel alone does not create the database.

## Local use

Use Node.js 24 and npm. In the folder containing `package.json`:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. To connect locally, copy `.env.example` to `.env.local`, fill in the two values, and restart the development server.

For a production build:

```sh
npm run build
npm start
```

## Project files

| Location | Purpose |
| --- | --- |
| `app/` | Next.js pages, styling and public database configuration endpoint |
| `features/desk/` | Student, course, batch, filter and PDF workflows |
| `supabase/migrations/` | Database migrations, applied in filename order |
| `supabase/setup/first-administrator.sql` | One-time administrator and first-campus setup |
| `public/fonts/` | Bundled report fonts and their licenses |
| `vercel.json` | Vercel framework, install and build settings |
| `.env.example` | Required environment variable names |

## Validation

Verified for this export: the standard Next.js production build, TypeScript, public-key configuration handling, and first-administrator setup against an isolated PostgreSQL database.

`npm run build` checks the Vercel edition with the standard Next.js production compiler and TypeScript. Database and report tests are also included:

```sh
npm run typecheck
npm run test:database
npm run test:bootstrap
npm run test:config
npm run test:reports
npm run test:reviews
npm run test:clubs
```

The database checks run in an isolated PostgreSQL test environment. They do not connect to or change your Supabase account. Remote Supabase behavior and a deployment in your Vercel account must be verified after setup.

This download is a separate Vercel edition. It does not change the existing private preview.
