# Task: Public Signup & Onboarding

**Status:** Done
**Completed:** 2026-02

---

## What was done

### Landing Page

- [x] Public-facing hero section with dashboard preview
- [x] Feature cards (AI Analysis, Visual Dashboard, Easy Upload, Security)
- [x] CTA buttons → `/login`
- [x] Redirects authenticated users to `/dashboard`

### Onboarding Flow

- [x] 4-step flow: Welcome → Create Profile → Upload Prompt → Dashboard
- [x] "Skip for now" option on upload step
- [x] Anti-stale redirect if user already has profiles
- [x] Add Profile mode via `?mode=add`

### Access Control

- [x] Open signup — any Google account can sign in
- [x] Profile access via `profile_allowed_emails` table
- [x] Auto-claim profiles on login
- [x] Token-based invite system for sharing
