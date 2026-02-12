# PRD: Metric Name Normalization

**Last Updated:** 2026-02-03

---

## Problem

Same blood test appears with different names across lab PDFs (e.g., "ALT" vs "Alanin aminotransferaz" vs "SGPT"). This fragments health trends—instead of one unified chart, users see multiple disconnected metrics.

**Current state:** 168 unique metric names in DB, many are duplicates. The `metric_aliases` table exists with 54 valid aliases but the extraction worker query is broken.

---

## Solution: 2-Step Approval Flow with AI

### Step 1: Extraction Review

1. User uploads PDF
2. AI extracts metrics (name, value, unit, ref range)
3. Show raw extraction with warning: "AI extraction may have errors. Please compare with your PDF."
4. User can edit any value
5. User confirms extraction

### Step 2: Merge Suggestions

After user confirms extraction:

1. Fetch user's existing metrics from database
2. Run basic analysis:
   - Check global aliases table
   - Fuzzy name matching
   - Unit comparison
   - Reference range overlap
3. Call OpenAI API for medical knowledge verification
4. Combine rule-based analysis + AI suggestions
5. Show merge proposals grouped by confidence:
   - **HIGH CONFIDENCE** — pre-checked
   - **MEDIUM CONFIDENCE** — user should review
   - **NEW METRICS** — no matches found
6. User toggles merges on/off
7. User confirms → save to DB

---

## Normalization Algorithm

### Hard Blocks (NEVER merge)

- Different base units (g/L vs mg/L vs %)
- `#` vs `%` suffix (absolute count vs percentage are different tests)
- `Total` vs `Direct` vs `Free` prefix (different tests)
- Reference ranges don't overlap at all

### High Confidence

- Known alias from global `metric_aliases` table
- Same/compatible unit AND reference ranges overlap >50%
- Very high name similarity (>0.9 fuzzy match) + unit match

### Medium Confidence

- Same unit + moderate name similarity (0.6-0.9)
- Medical abbreviation ↔ full name (AI verification)
- Turkish ↔ English translation candidates

---

## OpenAI Prompt Specification

### System Prompt

```
You are a medical data assistant for a health tracking app.

Users upload blood test PDFs. We extract metrics using AI (OCR + vision).

IMPORTANT: Extraction may have errors (wrong units, typos, misread values) because PDFs are processed as images.

Your job: suggest which NEW metrics should merge with EXISTING metrics.
```

### Good Practices (include in prompt)

- K+ is potassium, Na+ is sodium, Fe is iron, Ca is calcium
- ALT = SGPT = Alanin aminotransferaz (same liver enzyme)
- AST = SGOT = Aspartat transaminaz (same liver enzyme)
- Turkish and English names for same test should merge (Potasyum = Potassium)
- Typos should merge (Potasiyum → Potasyum)
- Same unit + overlapping reference range = likely same test

### Bad Practices (warn in prompt)

- NEVER merge # and % variants (Bazofil# ≠ Bazofil%) — DIFFERENT tests
- NEVER merge Total vs Direct vs Free (Total Bilirubin ≠ Direct Bilirubin)
- NEVER merge if units are fundamentally different (g/L vs mg/dL vs %)
- NEVER merge if reference ranges don't overlap at all
- ALT and AST are DIFFERENT tests (both liver enzymes, but not the same)
- Be cautious: unit mismatches might be OCR errors, not different tests

### Data to Include

- EXISTING metrics: list of (name, unit, ref_low, ref_high) from user's profile
- NEW metrics: list of (name, value, unit, ref_low, ref_high) from current PDF
- Basic analysis results: fuzzy matches found, known aliases matched

### Expected Response Format

```json
{
  "suggestions": [
    {
      "new_metric": "K+",
      "merge_with": "Potasyum",
      "confidence": "HIGH",
      "reasoning": "K+ is the chemical symbol for Potassium (Potasyum in Turkish)"
    },
    {
      "new_metric": "Bazofil#",
      "merge_with": null,
      "confidence": null,
      "reasoning": "No matching metric found. Will be created as new."
    }
  ]
}
```

---

## Global Aliases Table

- `metric_aliases` becomes GLOBAL (not per-profile)
- Medical facts (K+ = Potassium) are universal, shared across all profiles
- Existing 54 aliases validated and correct
- When user approves a merge, optionally add to global aliases for future use

---

## Examples

### Should Merge (HIGH)

| New Metric | Existing Metric        | Reason                         |
| ---------- | ---------------------- | ------------------------------ |
| K+         | Potasyum               | Chemical symbol = Turkish name |
| Albumin    | Albümin                | English = Turkish              |
| ALT        | Alanin aminotransferaz | Abbreviation = full name       |
| Potasiyum  | Potasyum               | Typo                           |

### Must NOT Merge

| Metric A        | Metric B         | Reason                                 |
| --------------- | ---------------- | -------------------------------------- |
| Bazofil#        | Bazofil%         | Different tests (count vs percentage)  |
| Total Bilirubin | Direct Bilirubin | Different tests                        |
| ALT             | AST              | Different liver enzymes                |
| Albümine (mg/L) | Albümin (g/L)    | Different units, likely different test |

---

## Schema Changes Needed

1. Fix Kalsiyum unit: currently "L", should be "mg/dL"
2. Restructure `metric_aliases` to be global (remove profile dependency)
3. Consider: add `canonical_name` column directly to `metric_aliases` OR create separate `canonical_metrics` table

---

## Implementation Phases

1. Split current approval into 2 steps (UI change)
2. Add warning banner and suspicious value flagging in Step 1
3. Implement normalization algorithm (hard blocks + fuzzy matching)
4. Add OpenAI API call for medical verification
5. Build Step 2 UI with confidence grouping and checkboxes
6. Learning: save approved merges to global aliases

---

## Success Metrics

- Zero false merges (different tests merged together)
- Reduced unique metric names over time (consolidation working)
- User catches AI extraction errors before they reach dashboard
