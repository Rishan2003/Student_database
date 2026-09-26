# Club sheet matching update

Replace the existing application source with this package and redeploy the same Vercel project, keeping its Supabase environment variables.
No additional database migration is required for this matching update.

- Recognizes first names and consecutive shortened names when a single enrollment matches.
- Recognizes PRE-122, 122 (PRE), PRE 122, PRE/122 and Bengali batch digits.
- Keeps explicit course prefixes and separate number groups distinct.
- Requires manual selection for ambiguous names or enrollments.
- Labels short-name matches so staff can check the full selected name before saving.

Validation: existing club parsing/matching tests and added matching regression cases passed. Changed TypeScript/TSX files were transpiled successfully. A full production build was not run; the exact project dependencies were unavailable locally. Tests used TypeScript 5.9.3 and locally cached Zod 3.22.4 without changing package.json or package-lock.json.
