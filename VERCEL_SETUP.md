# Deploy the IELTS Student Desk on Vercel

The app runs on Vercel. Student data and staff accounts live in your Supabase project. Follow these steps in order to enable real student saving.

## 1. Create the database

Use a new, dedicated Supabase project for this application. These initial migrations create their own tables and are not intended to be pasted over an existing conflicting schema.

In your Supabase project's **SQL Editor**, open and run these files separately, in this order:

1. `supabase/migrations/202609110001_student_desk.sql`
2. `supabase/migrations/202609110002_student_desk_rpc.sql`
3. `supabase/migrations/20260911180723_require_batch_for_new_students.sql`

Wait for each file to finish successfully before running the next. Each file uses a transaction. Do not rerun a migration that already succeeded. The migrations create the tables, roles, access policies and application functions. They do not add sample students.

In Supabase's Data API settings, retain `public` as an exposed schema and keep `private` unexposed. The migrations explicitly grant the application the permissions it needs.

## 2. Put the source in your Git repository

Unzip this download. Add the contents of `hexas-ielts-vercel` to a GitHub, GitLab or Bitbucket repository. Keep `package.json`, `package-lock.json`, `app`, `public`, `supabase` and `vercel.json` together in the repository root.

If you keep the enclosing `hexas-ielts-vercel` directory in the repository, select that directory as the project's Root Directory when importing it in Vercel.

Do not upload `node_modules`, `.next`, or a populated `.env.local`. The included `.gitignore` excludes them. Keep all source files and font assets, including `.env.example`.

## 3. Import into Vercel

Create a new Vercel project and import the repository. Use these settings:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | The directory containing `package.json` |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the Next.js default |

The Node version and build commands are already declared in the project files. This is a Next.js application with a server endpoint; do not configure it as a static HTML export.

Add these Vercel environment variables before deploying:

| Variable | Value from Supabase |
| --- | --- |
| `SUPABASE_URL` | Your project's HTTPS URL |
| `SUPABASE_ANON_KEY` | Your **publishable** key (`sb_publishable_...`) or legacy **anon** key |

Despite its variable name, `SUPABASE_ANON_KEY` accepts the newer publishable key. Copy values from your Supabase project's Connect dialog or API key settings.

These values configure browser access protected by Supabase Auth and row-level security. Do not enter a `service_role` JWT or an `sb_secret_` key; the app rejects those keys.

Click **Deploy**. If you add or change environment variables later, redeploy to apply them. Choose the Vercel environments where the values should apply; preview deployments can use a separate Supabase project when needed.

Official instructions: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [environment variables](https://vercel.com/docs/environment-variables), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).

## 4. Configure sign-in and activate your account

In Supabase **Authentication → URL Configuration**, set **Site URL** to your deployed Vercel URL. Add that same URL to the allowed redirect URLs. Add `http://localhost:3000` too if you will use local development. Update these settings if you later use a custom domain. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)

Keep email/password sign-in enabled. Create your own account through the app's signup form and complete email confirmation if enabled. Alternatively, create your own user in Supabase **Authentication → Users** and set its password there. Never put a password into the source files.

The account initially has no student access. To activate the first administrator:

1. Open `supabase/setup/first-administrator.sql`.
2. Replace `CHANGE_ME@example.com` with the email of your Auth account.
3. Adjust `owner_name`, `campus_name` and `campus_code` if needed. The default campus is HEXA’S MajorTila (`MT`).
4. Run the edited script in the Supabase SQL Editor.
5. Confirm the result shows your account as `super_admin` with `is_active = true`.
6. Sign out and sign back in to the app.

This script intentionally stops if a different active administrator already exists. Manage subsequent staff from **Settings & access** in the app. New staff accounts stay inactive until the administrator assigns access.

## 5. Begin using the app

1. Create a course type in **Courses**.
2. Add a batch for that course in **Batches**.
3. Open that batch and use **Add student** to register each student inside it, including their module levels and IELTS plans.
4. Reload the page and confirm the saved student remains.
5. Apply student filters and export a summary or detailed PDF. The report includes all matching students, not only the visible table page.

Supabase enforces staff roles and campus permissions. Your Vercel URL does not inherit the owner-only gate of the original private preview; real student information is protected by the application's sign-in and database access rules.

## Common setup issues

| What you see | What to check |
| --- | --- |
| Sample students / Setup pending | Check both Vercel environment variables and redeploy. Confirm the key is public. |
| Missing `desk_snapshot` or `desk_write` function | Confirm all SQL migrations finished in the same project as `SUPABASE_URL`. |
| Account awaiting activation | Run first-administrator setup for your exact Auth email, or ask the existing app administrator to activate your staff account. |
| Email confirmation opens the wrong website | Correct Supabase Site URL and allowed redirect URLs. |
| The app signs in but courses and students are empty | A new database starts empty. Add your own courses, batches and students. |
| Vercel cannot find `package.json` | Select the extracted application folder as Root Directory. |
| Importing the ZIP directly is not offered | Extract it and import its Git repository, or use Vercel CLI from the extracted folder. |

## Optional: deploy from your computer

Vercel also supports deploying a Next.js project with its CLI. In this extracted app folder, install the Vercel CLI following its official instructions, then run `vercel` and follow the account and project prompts. Set the environment variables in Vercel before the production deployment. [Vercel CLI](https://vercel.com/docs/cli)
