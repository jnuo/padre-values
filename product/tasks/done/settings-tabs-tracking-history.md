# Task: Settings Tabs — Tracking History (Kilo & Tansiyon)

**Status:** Done
**Completed:** 2026-02-13
**PR:** #25
**Priority:** High
**Created:** 2026-02-13

---

## Problem

The Settings/Files page currently only shows uploaded PDF files ("Yüklenen Dosyalar"). There's no way to view, edit, or delete past weight and blood pressure entries. Users have to ask me (the developer) to delete entries via SQL.

## Solution

Restructure the settings files page into a tabbed layout:

### Tab structure

1. **Tahliller** — Current "Yüklenen Dosyalar" table (uploaded PDF files with metric counts)
2. **Kilo** — Weight history table with inline edit/delete
3. **Tansiyon** — Blood pressure history table with inline edit/delete

### Rename

- Page title: "Dosyalar" → "Tahliller / Ölçümler" (or just use tabs, no page title)
- Settings tab label: "Dosyalar" → "Tahliller" or "Ölçümler"

### Kilo tab

- Table columns: Tarih, Kilo (kg), Not, Actions
- Inline edit: click value to edit weight, notes
- Delete button with confirmation
- Sorted by date descending

### Tansiyon tab

- Table columns: Tarih, Sistolik/Diastolik, Nabız, Actions
- Inline edit: click values to edit systolic, diastolic, pulse
- Delete button with confirmation
- Status badge (Normal/Yüksek/etc.) per row
- Sorted by date descending

### Design

- Use `/frontend-design` skill for design decisions
- Follow brand guidelines in `product/brand-guidelines/BRAND.md`
- Tab/chip style navigation (not sidebar tabs)
- Consistent with existing table style from Yüklenen Dosyalar
- Mobile-friendly (responsive table or card layout on small screens)

## Files to modify

- `web/src/app/settings/files/page.tsx` or create new route structure
- May need new API: `PUT /api/tracking/[id]` for inline edits
- Existing: `DELETE /api/tracking/[id]` already works

## Reference

- Current files page: see screenshot in task
- Existing delete API: `web/src/app/api/tracking/[id]/route.ts`
- Brand guidelines: `product/brand-guidelines/BRAND.md`
