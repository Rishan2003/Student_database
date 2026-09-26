# Flexible club sheet matching

This package must replace the application source and be deployed to the existing Vercel project before the website changes. Keep the existing Supabase environment variables. No database migration is required for this frontend update.

## Behavior
- Auto-selects unique whole-word name matches, including omitted middle names, reordered names, and common Md/Mohammed title variations.
- Accepts rearranged batch prefixes, batch labels, leading zeroes, Bengali digits and the saved full course name.
- Offers up to five ranked suggestions for spelling differences, initials, joined names, missing batches and mismatched course labels. Suggestions require explicit selection before saving.
- Preserves manual choice when more than one enrollment matches.
- Adds per-row student search and sheet-name/batch editing with rechecking.

## Changed files
features/desk/club-model.ts
features/desk/club-attendance.tsx
tests/clubs.cjs
CLUB_ATTENDANCE.md

## Validation
All club parsing/matching regression tests passed, including suggestion confirmation and ambiguity cases. Strict TypeScript checking passed for the matcher and model; the UI TSX transpiled without syntax diagnostics. Validation used cached TypeScript 5.9.3 and Zod 3.22.4 without changing the project dependency manifests. A full production build and browser interaction test were not run because the exact application dependencies were unavailable locally.
