# Task: Playwright E2E Test Setup + Weight Dialog Tests

**Status:** Pending
**Created:** 2026-02-13

---

## Problem

No E2E tests exist. Manual testing is the only way to verify features like the weight dialog, comma/period input, and single-log-per-day replace flow.

---

## Solution

Set up Playwright for E2E testing with a GitHub Actions workflow that runs on every PR. First test covers the weight dialog.

### Auth Strategy

The app uses NextAuth with JWT strategy (no DB adapter). For E2E tests:

- Set `NEXTAUTH_SECRET` to a known test value in the test env
- Generate a valid JWT session cookie using `jose` library
- Inject the cookie into Playwright's browser context before each test
- This bypasses Google OAuth entirely — no real Google login needed

The test JWT will contain a fake `dbId` that matches a test user seeded in the Neon branch DB.

---

## Files to Create

### 1. `web/playwright.config.ts`

- Base URL: `http://localhost:3000`
- `webServer` config to auto-start `npm run dev` before tests
- Single Chromium project (keep it simple for now)
- Screenshot on failure

### 2. `web/e2e/helpers/auth.ts`

- `createTestSession()` — uses `jose` to sign a JWT with test user data
- `authenticatedContext()` — creates a Playwright browser context with the session cookie set
- Uses env var `TEST_NEXTAUTH_SECRET` (or falls back to `NEXTAUTH_SECRET`)

### 3. `web/e2e/helpers/db.ts`

- `seedTestUser()` — inserts a test user + profile + access into the DB
- `cleanupTestData()` — removes test tracking entries (not the user, to keep it idempotent)
- Uses `NEON_DATABASE_URL` from env (pointed at a Neon test branch)

### 4. `web/e2e/weight-dialog.spec.ts`

Test cases:

- **Opens weight dialog** — click "Ekle" → "Kilo Ekle", dialog appears
- **Accepts comma as decimal** — type "82,5", save button is enabled
- **Accepts period as decimal** — type "82.5", save button is enabled
- **Saves weight successfully** — enter value, click "Kaydet", toast appears "Kilo kaydedildi"
- **Shows replace confirmation on duplicate** — save once, reopen dialog, save again → warning banner with "Bugün zaten kayıt var" appears, button says "Değiştir"
- **Replaces existing entry** — after seeing confirmation, click "Değiştir" → success toast

### 5. `.github/workflows/e2e.yml`

- Trigger: `pull_request` on `main`
- Steps: checkout → setup Node 20 → install deps → install Playwright browsers → run tests
- Env vars: `NEON_DATABASE_URL` (from GitHub secrets, pointed at test branch), `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`/`SECRET` (dummy values, not used in tests)
- Upload test results artifact on failure

## Files to Modify

### 6. `web/package.json`

- Add `@playwright/test` to devDependencies
- Add `jose` to devDependencies (for JWT signing in test helpers)
- Add script: `"test:e2e": "playwright test"`

### 7. `web/.gitignore`

- Add `test-results/`, `playwright-report/`, `playwright/.cache/`

---

## Dependencies

- `@playwright/test` — test framework + browser automation
- `jose` — JWT signing for auth helper (small, no native deps)

---

## Future (not in scope)

- Blood pressure dialog tests (same pattern, easy to add later)
- Login/logout flow tests
- Upload flow tests
- Mobile viewport tests
