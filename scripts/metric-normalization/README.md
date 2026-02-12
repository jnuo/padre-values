# Metric Name Normalization

Merging variant metric names into canonical names in the ViziAI database. Same blood test can appear under different names across Turkish lab PDFs (e.g., "ALT", "Alanin aminotransferaz", "Alt (Alanine Aminotransferaz)" are all the same liver enzyme test).

## When to Run

- After noticing fragmented charts on the dashboard (same test split into multiple cards)
- After bulk uploads from a new lab (new naming conventions)
- Periodically: query the DB for metrics with same unit but different names

## Detection Query

```sql
-- Find potential duplicates: metrics with same unit but different names
SELECT name, unit, COUNT(*) as row_count
FROM metrics
WHERE profile_id = '<profile_id>'
GROUP BY name, unit
ORDER BY unit, name;
```

Look for groups that share a unit and have similar names (fuzzy match, abbreviation vs full name, Turkish vs English, typos).

## The 7-Step Workflow

### 1. Query DB

Show all values, units, ref ranges, and dates for the candidate group:

```sql
SELECT name, unit, value, ref_low, ref_high, created_at
FROM metrics
WHERE name IN ('Variant1', 'Variant2', ...)
ORDER BY value;
```

### 2. Check Reference Ranges Online

Cross-reference with medical sources:

- Cleveland Clinic
- Mayo Clinic
- Lab-specific reference sheets

### 3. Detect Outliers

Flag values far outside the medical reference range:

- `> 3x ref_high` — likely AI extraction error
- `< 0.3x ref_low` — likely AI extraction error
- Show each flagged value with its report date for context

### 4. Present to User for Approval

For each group, the user decides:

- **Merge:** yes/no
- **Reference range:** approve or adjust
- **Outliers:** delete / correct value / keep as-is

### 5. Execute Merge

Add the group config to `normalize.py` and run:

```bash
# Dry run (default) — shows what would change
python3 scripts/metric-normalization/normalize.py --group "ALT (Alanin Aminotransferaz)"

# Apply changes
python3 scripts/metric-normalization/normalize.py --group "ALT (Alanin Aminotransferaz)" --apply
```

### 6. Update Checklist

Mark the group done in `completed-merges.md` with notes (dupes deleted, ref range, outliers handled).

### 7. Aliases

The script automatically inserts aliases into the `metric_aliases` table (step 5 handles this).

## Script Usage

```bash
# List all configured groups
python3 scripts/metric-normalization/normalize.py --list

# Dry run for a specific group
python3 scripts/metric-normalization/normalize.py --group "Kalsiyum"

# Apply changes (writes to DB)
python3 scripts/metric-normalization/normalize.py --group "Kalsiyum" --apply

# Use a specific DB URL (overrides .env.local)
python3 scripts/metric-normalization/normalize.py --group "Kalsiyum" --apply --url "postgres://..."
```

Requires: `pip install psycopg2-binary`

## Hard Rules — NEVER Merge

- **# vs %** — absolute count vs percentage are different tests (e.g., Bazofil# vs Bazofil%)
- **Total vs Direct vs Free** — different tests (e.g., Total Bilirubin vs Direkt Bilirubin)
- **Incompatible units** — g/L vs mg/dL vs % are fundamentally different
- **Non-overlapping reference ranges** — if ranges don't overlap at all, likely different tests

## Related Files

- `scripts/metric-normalization/normalize.py` — the merge script
- `scripts/metric-normalization/completed-merges.md` — checklist of all completed merges
- `db-schema/migrations/20260212_metric_aliases_global.sql` — alias table schema
- `web/src/app/api/aliases/route.ts` — GET endpoint returning alias map
- `web/src/app/upload/page.tsx` — inline suggestion UI in upload review
