# VizAI - Blood Test Analysis System

## What is this?
Medical data visualization app: Python backend extracts blood test values from PDFs using OpenAI → stores in Google Sheets → Next.js dashboard visualizes trends with interactive charts.

## Project Structure & Module Organization
- **Backend (Python):**
  - Source code: `src/`
  - Entrypoint: `main.py`
  - Key files: `pdf_reader.py`, `sheets_updater.py`, `drive_monitor.py`
- **Frontend (Web):**
  - Dashboard: `web/src/app/page.tsx`
  - API: `web/src/app/api/data/route.ts`
  - Charts: `web/src/components/metric-chart.tsx`
  - Tests: `web/src/__tests__/`
- **Data Source:**
  - Google Sheets with "Looker" tab (metric data) and "Reference Values" tab (normal ranges)
  - Metric names in Turkish & English (e.g., "Hemoglobin" = "HGB")

## Build, Test, and Development Commands
- **Backend:**
  - Install: `pip install -r requirements.txt`
  - Run: `python main.py`
- **Frontend:**
  - Install: `cd web && npm install`
  - Develop: `npm run dev`
  - Build: `npm run build`
  - Test: `npm test`
  - Lint: `npm run lint`

## Coding Style & Naming Conventions
- **Python:** 4 spaces, snake_case, docstrings.
- **TypeScript/JavaScript:** 2 spaces, camelCase, PascalCase for components.
- Format and lint with ESLint/Prettier: `npm run lint`

## Testing Guidelines
- **Frontend:** Jest tests in `web/src/__tests__/`, files as `*.test.ts(x)`.
  - Run: `npm test` or `npm run test:watch`
- **Backend:** Add Python tests if present under `tests/`.

## Commit & Pull Request Guidelines
- Prefix messages: `feat:`, `fix:`, `refactor:`, etc.
- Use imperative mood (e.g., `fix: update dependencies`).
- PRs should describe changes, link issues, and include screenshots for UI.

## Common Tasks & Workflows
- **UI changes:** Edit `web/src/app/page.tsx` or components, run `npm run dev` to preview
- **Add new metrics:** Update Google Sheets, refresh dashboard
- **Fix chart issues:** Check `metric-chart.tsx` and data structure from API
- **Backend changes:** Modify `src/` files, restart `python main.py`
- **Debugging:** Check browser console, API responses at `/api/data`, Google Sheets format

## TODO List
See [TODO.md](TODO.md) for a list of current tasks.

## Data Flow
1. PDFs uploaded to Google Drive folder
2. `main.py` monitors Drive → extracts values via OpenAI
3. Updates Google Sheets "Looker" tab (dates + metric values)
4. Dashboard fetches via `/api/data` → renders charts with Recharts
5. Reference ranges from "Reference Values" tab determine green/red indicators

## Important Context
- **Metric naming:** Handle Turkish/English variants (e.g., "Hemoglobin"/"HGB", "Trombosit"/"Platelets")
- **Date formats:** Support MM/DD/YYYY and YYYY-MM-DD
- **Mobile-first:** Dashboard must work on phones, tablets, desktop
- **Security:** No secrets in code, use env vars for credentials

## Warnings for Future Agents
**CRITICAL: When asked for UI prototypes/changes, ALWAYS:**
1. Actually modify the code in `web/src/`
2. Run `npm run dev` so user can see it live at localhost:3000
3. Never just show code snippets as a "prototype"—user needs to see/interact with real rendered UI
4. Take screenshots if needed to confirm changes

**Example:** If user asks "can you make a prototype for X feature?", implement it in the actual codebase and start dev server, don't just write example code.
