# Task: Security Audit Findings

**Status:** In Progress
**Priority:** Critical
**Created:** 2026-02-13

---

## Summary

Comprehensive security audit of all API routes, auth, file uploads, and dependencies. Fixed the critical and high items. Medium items remain.

---

## Fixed (PR #23)

- [x] Add authorization checks to `/api/metrics`, `/api/metric-order`, `/api/cleanup`
- [x] Remove unused debug/legacy endpoints
- [x] Add security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- [x] Fix open redirect on login
- [x] Harden worker route signature verification
- [x] Remove internal error details from API responses

## Fixed (PR #24)

- [x] Reduce session max age from 30d to 24h
- [x] PDF magic byte validation on upload
- [x] Remove all remaining `details: String(error)` from API responses (14 occurrences across 13 files)
- [x] `npm audit fix` — 0 vulnerabilities remaining
- [x] Sanitize this task file (no attack details in public repo)

---

## Remaining

- [ ] Blob storage access level
- [ ] Rate limiting on sensitive endpoints

---

## Already Secure

- All SQL queries use parameterized template literals
- Upload, tracking, profiles, settings endpoints have proper access checks
- Google OAuth via NextAuth properly configured
- Invite tokens use `randomBytes(32)`
- No hardcoded secrets in source code
- Sentry source maps disabled
- `.env` files properly gitignored
