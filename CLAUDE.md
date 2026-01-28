# ViziAI

AI-powered blood test PDF analyzer with visual health insights. Built for tracking dad's blood test trends.

## On Session Start

1. Use `/notion` skill to check tasks with topic `viziai`
2. Show pending tasks and ask: "Work on these or something else?"

## Before Making Changes

**ALWAYS check these first:**

1. `git status` - Check current branch and uncommitted changes
2. `git log --oneline -5` - See recent commits
3. `gh pr list` - Check for open PRs on this repo
4. If on a feature branch with an open PR, **warn the user** before pushing new commits

## Tech Stack

- **Database**: Neon Postgres (serverless, no inactivity pause)
- **Auth**: NextAuth.js with Google OAuth
- **Frontend**: Next.js (in `web/`)
- **Backend**: Python (PDF extraction)
- **AI**: OpenAI for PDF text extraction

## Key Files

- Frontend: `web/src/`
- API routes: `web/src/app/api/`
- Auth config: `web/src/lib/auth.ts`
- DB client: `web/src/lib/db.ts`
- PDF processing: `scripts/`

## Environment Variables (Vercel)

Required for deployment:

- `NEON_DATABASE_URL` - Neon connection string
- `NEXTAUTH_URL` - Production URL (e.g., https://viziai.vercel.app)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

## Allowed Emails

Users must be in `profile_allowed_emails` table to login:

- onurovalii@gmail.com
- hulyaovaliyil@gmail.com
- ovaliolcay@yahoo.com

## Notes

- Low-activity personal project
- Data is dad's blood test results (Turkish lab reports)
- All 1770 records migrated from Supabase to Neon
