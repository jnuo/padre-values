# Task: Multi-Profile System

**Status:** Done
**Completed:** 2026-02

---

## What was done

### Data Model

- [x] `users` table — app-level user records
- [x] `user_access` table — links users to profiles with access levels (owner/editor/viewer)
- [x] `profile_allowed_emails` — email-based profile linking with claim tracking
- [x] DB functions: `upsert_user()`, `claim_profiles_for_user()`, `check_duplicate_upload()`

### Profile Selector

- [x] Dropdown menu with access level badges (Crown/Pencil/Eye icons)
- [x] Report count per profile
- [x] "Yeni Profil Ekle" option
- [x] Current profile highlighted with checkmark

### Profile Creation

- [x] Clean form with auto-focus input
- [x] Enter key support, loading state, error display
- [x] Add mode via `?mode=add` query param
- [x] Auto-selects newly created profile

### Profile Management

- [x] Delete profile (owners only, with confirmation)
- [x] Leave profile (non-owners)

### Login Flow

- [x] Google OAuth → auto-claim profiles → dashboard
- [x] New users → onboarding flow
- [x] Multiple profiles → profile switcher in header
