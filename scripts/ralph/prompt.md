# Ralph Agent Instructions for ViziAI

You are an autonomous coding agent working on ViziAI, a blood test tracking application.

## Your Task

1. Read `scripts/ralph/prd.json` to see all user stories
2. Read `scripts/ralph/progress.txt` to see:
   - Codebase patterns at the TOP (check these FIRST)
   - Previous learnings and completed work
3. Verify you're on the correct branch: `ralph/supabase-migration`
   - If not, create and checkout the branch
4. Pick the highest priority story where `passes: false`
5. Implement that ONE story completely
6. Run any relevant checks:
   - Python: `python -m py_compile <file>` for syntax
   - TypeScript: `cd web && npm run build` for type checking
   - Tests if they exist
7. Update AGENTS.md files with learnings (if you discovered reusable patterns)
8. Commit with message: `feat: [Story ID] - [Title]`
9. Update `scripts/ralph/prd.json`: set `passes: true` for completed story
10. Append learnings to `scripts/ralph/progress.txt`

## Progress Format

APPEND to progress.txt after completing a story:

```
---
## [Date] - [Story ID]: [Title]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
```

## Codebase Patterns

Add reusable patterns to the TOP of progress.txt under "## Codebase Patterns":

```
## Codebase Patterns
- Python config: Use src/config.py for constants, .env for secrets
- Supabase: Use service key for server-side, anon key for client
- Next.js API routes: Located in web/src/app/api/
```

## Current Architecture

**Python Backend (src/):**

- `main.py` - Entry point, orchestrates PDF processing
- `drive_monitor.py` - Downloads PDFs from Google Drive
- `pdf_reader.py` - Extracts lab values using OpenAI Vision
- `sheets_updater.py` - Updates Google Sheets (being replaced by Supabase)
- `config.py` - Configuration constants

**Next.js Frontend (web/):**

- `src/app/page.tsx` - Landing page
- `src/app/dashboard/` - Dashboard with charts
- `src/app/api/` - API routes
- Uses Tailwind CSS, Recharts for visualization

**Data Flow (current):**

1. PDFs uploaded to Google Drive
2. Python script downloads → OpenAI extracts → Google Sheets updated
3. Next.js reads from Google Sheets API

**Data Flow (target):**

1. PDFs uploaded to Google Drive (or direct upload later)
2. Python script downloads → OpenAI extracts → Supabase updated
3. Next.js reads from Supabase
4. Users authenticate via Supabase Auth

## Visual Verification with Chrome MCP

For UI-related stories (especially US-007), use Chrome DevTools MCP:

1. Start dev server: `cd web && npm run dev` (run in background)
2. Navigate: `mcp__chrome-devtools__navigate_page` to `http://localhost:3000/dashboard`
3. Screenshot: `mcp__chrome-devtools__take_screenshot` to verify UI
4. Check: Dark theme, proper layout, charts render, no console errors
5. Snapshot: `mcp__chrome-devtools__take_snapshot` for accessibility check

## Stop Conditions

**After completing US-007 (Phase 1 complete):**

- Output: `<promise>PHASE1_COMPLETE</promise>`
- DO NOT continue to US-008
- User will test, approve, and set up Google OAuth before Phase 2

**After completing US-011 (All stories complete):**

- Output: `<promise>COMPLETE</promise>`

## Important Notes

- Keep changes minimal and focused on ONE story at a time
- Don't refactor unrelated code
- If a story is blocked (missing credentials, etc.), add notes to the story and move to next
- Commit after EACH completed story
- Always verify the branch before making changes
