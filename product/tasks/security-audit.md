# Task: Security Audit Findings

**Status:** In Progress
**Priority:** Critical
**Created:** 2026-02-13

---

## Summary

Comprehensive security audit of all API routes, authentication, file uploads, and dependencies. Found 5 critical, 4 high, and 5 medium severity issues. Core problem: several endpoints missing authorization checks, allowing any authenticated user to read or delete other users' health data.

---

## Critical

### 1. `/api/metrics` — IDOR: any user can read any profile's blood tests

**File:** `web/src/app/api/metrics/route.ts`

Middleware requires login, but the handler never calls `hasProfileAccess()`. Any authenticated user can pass any `profileId` query param and get all blood test data (metrics, values, reference ranges) for that profile.

**Fix:** Add `requireAuth()` + `hasProfileAccess()` check before querying.

### 2. `/api/metric-order` — IDOR: read + write any profile's metric order

**File:** `web/src/app/api/metric-order/route.ts`

Both GET and PUT have zero authorization checks. Middleware protects with auth, but any logged-in user can read or modify any profile's metric display order by passing a `profileName`.

**Fix:** Add `requireAuth()` + `hasProfileAccess()` to both GET and PUT.

### 3. `/api/cleanup` — any user can delete any profile's data

**File:** `web/src/app/api/cleanup/route.ts`

Checks authentication but never calls `hasProfileAccess()`. Any authenticated user can permanently delete all metrics, reports, processed files, and pending uploads for ANY profile.

**Fix:** Add `hasProfileAccess()` check, or better yet delete this endpoint (it's labelled "for testing").

### 4. `/api/test-db` — unauthenticated info disclosure

**File:** `web/src/app/api/test-db/route.ts`

Publicly accessible debug endpoint. Returns profile count, confirms whether `NEON_DATABASE_URL` is set, and on error leaks the full error string.

**Fix:** Delete this file entirely.

### 5. Uploaded PDFs stored with `access: "public"` on Vercel Blob

**File:** `web/src/app/api/upload/route.ts:126-133`

All blood test PDFs are uploaded to Vercel Blob with `access: "public"`. Anyone with the URL can download them. URLs contain a SHA-256 hash (not guessable), but they're stored in the DB and could be leaked.

**Fix:** Change to `access: "private"` and serve PDFs through an authenticated API route using `getDownloadUrl()`.

---

## High

### 6. `/api/data` — no authentication at all

**File:** `web/src/app/api/data/route.ts`

Not in middleware's protected API routes list. No internal auth check. Completely public. Likely legacy (Google Sheets era) and unused.

**Fix:** Delete this file entirely.

### 7. No security headers configured

**File:** `web/next.config.ts`

Empty config — no `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`. Vercel adds some defaults but explicit configuration is needed.

**Fix:** Add `headers()` config to `next.config.ts`.

### 8. Open redirect on login

**File:** `web/src/middleware.ts:69-71`

The `redirect` query param on `/login` is used in `new URL(destination, request.url)` without validation. Attacker can craft `/login?redirect=https://evil.com` to redirect users off-site after login.

**Fix:** Validate that `redirect` starts with `/` and doesn't contain `//`.

### 9. Worker route signature bypass if env var missing

**File:** `web/src/app/api/upload/[id]/extract/worker/route.ts:287-291`

If `QSTASH_CURRENT_SIGNING_KEY` is unset in production, QStash signature verification is silently disabled. Should fail-closed (throw an error).

**Fix:** Only bypass verification when `NODE_ENV === "development"`, throw if key is missing in production.

---

## Medium

### 10. No rate limiting on any endpoint

No rate limiting anywhere. Login, invite token lookup, file upload, and API endpoints are all unmitigated against brute force and abuse.

**Fix:** Add Upstash Rate Limiting (already using Upstash for QStash).

### 11. Session defaults to 30-day max age

**File:** `web/src/lib/auth.ts`

No `session.maxAge` configured. NextAuth defaults to 30 days. For a health data app, 24 hours is more appropriate.

**Fix:** Add `session: { maxAge: 86400 }` to NextAuth config.

### 12. File upload validates MIME type only (client-controlled)

**File:** `web/src/app/api/upload/route.ts:66`

Only checks `file.type !== "application/pdf"` which is set by the client and easily spoofed. Should also validate PDF magic bytes (`%PDF` header).

**Fix:** Check `buffer.slice(0, 5).toString()` starts with `%PDF-`.

### 13. Error responses leak internal details

Multiple routes return `String(error)` to the client (e.g., `cleanup/route.ts:58`, `test-db/route.ts:27`). Stack traces and DB errors help attackers.

**Fix:** Log via Sentry/`reportError()`, return generic error messages to client.

### 14. npm audit: 3 vulnerabilities (2 high)

`tar` dependency has path traversal issues, `qs` has a DoS vulnerability. All fixable with `npm audit fix`.

**Fix:** Run `npm audit fix`.

---

## Already Secure

- All SQL queries use parameterized `sql` template literals (no SQL injection)
- `/api/upload`, `/api/tracking`, `/api/profiles`, `/api/settings` all check `hasProfileAccess()`
- Google OAuth via NextAuth properly configured
- Invite tokens generated with `randomBytes(32)` (cryptographically strong)
- No hardcoded secrets in source code
- Sentry source maps disabled (no source code exposure)
- `.env` files properly gitignored
