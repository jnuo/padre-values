# Task: Profile Sharing — Testing & Cleanup

**Status:** Pending
**Priority:** Medium
**Created:** 2026-02-13
**Extracted from:** `done/profile-sharing.md`

---

## Problem

Profile sharing feature is built and deployed, but some testing and minor tasks remain from the original implementation.

## Testing needed

- [ ] Open invite URL in incognito → login → claim works end-to-end
- [ ] After claiming: invitee sees profile in switcher with correct badge
- [ ] Role change (viewer ↔ editor) from settings
- [ ] Remove member from settings
- [ ] Revoke pending invite → link shows "revoked"
- [ ] Self-invite blocked
- [ ] Duplicate invite blocked

## Minor tasks

- [ ] Show unclaimed `profile_allowed_emails` in access page (mom/dad appear as "invited but not signed up")
- [ ] Add "copy invite link" button on pending invites
- [ ] Delete "Test Profile Final" test profile from prod
