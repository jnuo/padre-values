# ViziAI

AI-powered blood test PDF analyzer with visual health insights. Built for tracking dad's blood test trends.

## On Session Start

1. Use `/notion` skill to check tasks with topic `viziai`
2. Show pending tasks and ask: "Work on these or something else?"

## Git Workflow Rules

**CRITICAL - NEVER commit directly to main branch.**

1. `git status` - Check current branch and uncommitted changes
2. `git log --oneline -5` - See recent commits
3. `gh pr list` - Check for open PRs on this repo

**Before making ANY changes, ask the user:**

- "Should I continue on `[current-branch]` or create a new branch?"
- If there's an open PR, ask: "PR #X is still open. Continue on this branch or wait for merge?"
- If on `main`, **ALWAYS create a new feature branch first**

**Branch naming:** `feature/descriptive-name` or `fix/issue-description`

```bash
# Example: Always start work on a new branch
git checkout -b feature/upload-improvements
```

**Never:**

- Commit directly to `main`
- Push to `main` without explicit user approval
- Continue on a branch without checking PR status first

## Database Migrations

**ALWAYS use Neon branching for migrations:**

1. **Create a branch in Neon Console:**
   - Go to https://console.neon.tech → Your project → Branches
   - Click "Create Branch" → name it `dev` or `migration-test`
   - Copy the branch connection string

2. **Test migration on branch:**

   ```bash
   # Set branch URL temporarily
   export NEON_DATABASE_URL="postgres://...branch-url..."

   # Run migration
   psql $NEON_DATABASE_URL -f db-schema/migrations/YYYYMMDD_migration_name.sql
   ```

3. **Verify it worked:**
   - Check tables exist
   - Test the app locally against the branch

4. **Apply to production:**

   ```bash
   # Use prod URL
   psql $NEON_DATABASE_URL -f db-schema/migrations/YYYYMMDD_migration_name.sql
   ```

5. **Delete the test branch** (optional, Neon has free tier limits)

**Why:** Neon branches are instant copies of your database. If migration fails, prod is untouched. Point-in-time recovery is available but branching is easier.

## Tech Stack

- **Framework**: Next.js 15 (App Router) - handles both frontend AND backend
- **Database**: Neon Postgres (serverless)
- **Auth**: NextAuth.js with Google OAuth
- **Async Jobs**: Upstash QStash (PDF extraction queue)
- **AI**: OpenAI GPT-4o Vision (extracts lab values from PDF images)
- **Storage**: Vercel Blob (temporary PDF storage)
- **Hosting**: Vercel

## Project Structure

```
viziai/
├── web/                 # Next.js app (the entire application)
│   ├── src/app/         # Pages and API routes
│   ├── src/components/  # React components
│   └── src/lib/         # Utilities (auth, db, etc.)
├── db-schema/           # SQL migrations for Neon
├── product/             # Brand guidelines, roadmap
└── _legacy/             # Archived Python code
```

## Key Files

- **Pages**: `web/src/app/` (dashboard, upload, settings, login)
- **API routes**: `web/src/app/api/` (all backend logic)
- **Auth**: `web/src/lib/auth.ts`
- **Database**: `web/src/lib/db.ts`
- **PDF extraction**: `web/src/app/api/upload/[id]/extract/worker/route.ts`

## Environment Variables (Vercel)

Required for deployment:

- `NEON_DATABASE_URL` - Neon connection string
- `NEXTAUTH_URL` - Production URL (https://vizi-ai.onurovali.me)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `OPENAI_API_KEY` - For PDF extraction (GPT-4o Vision)
- `QSTASH_URL` - Upstash QStash endpoint
- `QSTASH_TOKEN` - Upstash QStash token
- `QSTASH_CURRENT_SIGNING_KEY` - For request verification
- `QSTASH_NEXT_SIGNING_KEY` - For key rotation

**IMPORTANT:** When adding env vars via Vercel UI, ensure NO trailing newlines. Use CLI:

```bash
echo -n "value" | npx vercel env add VAR_NAME production
```

## Allowed Emails

Users must be in `profile_allowed_emails` table to login:

- onurovalii@gmail.com
- hulyaovaliyil@gmail.com
- ovaliolcay@yahoo.com

## Deployment

**CRITICAL — NEVER use `npx vercel --prod` or Vercel CLI to deploy.**

The CLI build produces a broken output (only a 404 page, no App Router routes). Deployments happen automatically when code is pushed/merged to `main` via GitHub integration.

- **To deploy:** Just merge the PR to `main`. Vercel auto-deploys from GitHub.
- **To redeploy:** Use `npx vercel redeploy <deployment-url>` to re-promote a known-good deployment.
- **If you accidentally CLI-deployed:** Find the last good auto-deploy with `npx vercel ls --prod`, then `npx vercel redeploy <that-url>`.

## Deployment Checklist

Before deploying to production, complete these steps:

### 1. Set Vercel Environment Variables

In Vercel project settings, add:

- `NEON_DATABASE_URL` - Neon connection string (from Neon dashboard)
- `NEXTAUTH_URL` - Production URL (e.g., `https://viziai.vercel.app`)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

### 2. Update Google OAuth Redirect URIs

In Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client:

- Add authorized redirect URI: `https://viziai.vercel.app/api/auth/callback/google`
- Remove old Supabase callback URLs if present

### 3. Test Production Deployment

- [ ] Login flow works with Google OAuth
- [ ] User data loads correctly from Neon
- [ ] All allowed emails can access the app

## Frontend & Design Work

Before any UI/design changes, reference:

- `product/brand-guidelines/BRAND.md` - Colors, typography, voice & tone
- `product/PROJECT-ROADMAP.md` - Feature roadmap and priorities

**Key brand rules:**

- Primary: Teal (#0D9488 light / #2DD4BF dark)
- Secondary/Accent: Coral (#F97066 light / #FDA4AF dark)
- Status colors: Green (normal), Amber (warning), Terracotta (critical - NOT bright red)
- Font: Inter with Turkish support
- Tone: Clear, calm, reassuring - never alarming

## Notes

- Low-activity personal project
- Data is dad's blood test results (Turkish lab reports)
- All 1770 records migrated from Supabase to Neon
