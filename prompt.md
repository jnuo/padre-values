# Ralph Agent Instructions - ViziAI Migration (TDD Approach)

You are an autonomous agent migrating ViziAI from Supabase to Neon + NextAuth.js.

## CRITICAL: TDD Workflow

**PHASE 1: Capture Baselines (prd-tests.json)**
Run ALL test capture stories FIRST before any migration code changes.
This creates the "golden" baseline that migration must match.

**PHASE 2: Migration (prd.json)**
Only start migration AFTER all baselines are captured.

## Your Workflow

1. **Check Phase**:
   - If `prd-tests.json` has incomplete stories → work on those first
   - Only move to `prd.json` when ALL test stories pass
2. **Read Progress**: Check `progress.txt` for patterns and learnings
3. **Implement**: Complete ONE story only
4. **Run Test Cases**: Execute ALL test cases for the story
5. **Quality Check**: ALL test cases must pass before marking complete
6. **Update Progress**: Append entry to `progress.txt`
7. **Commit**: `feat: [STORY-ID] - Title`
8. **Mark Complete**: Update story to `passes: true`

## Test-Driven Rules

- NEVER skip a test case
- If a test fails, FIX the implementation, don't change the test
- For API endpoints: response must EXACTLY match baseline (use diff)
- For error codes: status codes must be IDENTICAL
- For data: row counts and checksums must match

## Available Tools

### CLI Tools

- `neonctl` - Neon database management (authenticated)
- `supabase` - Supabase CLI (authenticated, project: umrhdgqvyipnraapshhl)
- `vercel` - Deployment (may need auth)

### Database Connection Info

- **Supabase Project ID**: umrhdgqvyipnraapshhl
- **Supabase Region**: eu-central-1 (Frankfurt)
- **Target Neon Region**: eu-central-1 (to minimize latency)

### Google OAuth Credentials

Located at: `client_secret_202913594422-e55e1jnki8j2pirskfd0s7tuo7ta5bi5.apps.googleusercontent.com.json`

- Client ID: `202913594422-e55e1jnki8j2pirskfd0s7tuo7ta5bi5.apps.googleusercontent.com`
- Project: etkoapp

### Key Files

- Backend config: `src/supabase_config.py`, `src/supabase_client.py`
- Frontend auth: `web/src/lib/supabase-browser.ts`, `web/src/lib/supabase-server.ts`
- Middleware: `web/src/middleware.ts`
- Schema: `supabase/migrations/*.sql`

## Important Notes

1. **Neon has no RLS** - Skip Supabase RLS policies when exporting schema
2. **NextAuth handles sessions differently** - Uses JWT by default, not cookies
3. **Preserve email allowlist logic** - Critical for access control
4. **Test locally before deploying** - Frontend on localhost:3000, backend as needed

## Stop Conditions

- Reply with `<promise>COMPLETE</promise>` when ALL stories pass
- If truly blocked (missing credentials, external action needed), stop and explain what's needed

## Progress Entry Format

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- Learnings for future iterations
---
```
