# Repository Guidelines
## Project Structure & Module Organization
- **Backend (Python):**
  - Source code: `src/`
  - Entrypoint: `main.py`
- **Frontend (Web):**
  - Source: `web/src/`
  - Tests: `web/src/__tests__/`
  - Public assets: `web/public/`
- **Other:**
  - Dependencies: `requirements.txt`, `web/package.json`
  - Docs: `README.md`, `WARP.md`

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

## Additional Notes
- Store secrets outside the repo.
- For help, see `README.md` or contact maintainers.
# Warnings for Future Agents

**IMPORTANT: When asked for UI prototypes, always render them visually in the web UI so the user can directly see/interact, not just as code. Never expect the user to read or interpret UI code as a prototype—always expose real visible UI!**
