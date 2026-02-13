# Task: Enforce Viewer Access on Write Endpoints

**Status:** Pending
**Priority:** Low
**Created:** 2026-02-13

---

## Problem

`POST /api/tracking` and `DELETE /api/tracking/[id]` use `hasProfileAccess()` which allows any access level (viewer/editor/owner) to write and delete tracking data. Viewers should be read-only.

## Fix

Check `getProfileAccessLevel()` on write/delete endpoints and block viewers:

- `POST /api/tracking` — require editor or owner
- `DELETE /api/tracking/[id]` — require editor or owner
- `POST /api/upload` — require editor or owner (verify current behavior)

## Note

Low priority since the app is currently family-only and all shared users are trusted. But should be fixed before opening up to wider audience.
