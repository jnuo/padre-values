# Task: PDF Upload & AI Extraction

**Status:** Done
**Completed:** 2026-02

---

## What was done

### Upload Flow

- [x] Drag-and-drop upload zone (`react-dropzone`)
- [x] Profile selection before upload
- [x] PDF-only file type validation
- [x] Progress states: idle → uploading → extracting → review → confirming → success

### AI Extraction

- [x] OpenAI GPT-4o with vision capabilities
- [x] Async processing via Upstash QStash (with local dev fallback)
- [x] PDF → multi-page image conversion via MuPDF
- [x] Turkish medical terminology extraction
- [x] Reference ranges, date detection, decimal normalization

### Review & Confirm UI

- [x] Interactive table with inline editing (name, value, unit, ref ranges)
- [x] Out-of-range highlighting
- [x] Delete button per metric row
- [x] Sample date picker
- [x] Metric alias suggestions with toggle to accept/reject

### Duplicate Detection

- [x] SHA-256 content hash on upload
- [x] Checks `processed_files` table per profile
- [x] Returns 409 with existing upload date
- [x] Cleans up stuck pending uploads

### Error Handling

- [x] Comprehensive with Sentry integration
- [x] QStash retry logic (2 retries, 5-min timeout)
- [x] Turkish user-friendly error messages
