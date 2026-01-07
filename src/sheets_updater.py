import gspread
import pandas as pd
from datetime import datetime
import os
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from src.config import GOOGLE_CREDENTIALS_FILE, SHEET_ID, SHEET_NAME, LOOKER_SHEET_NAME, REFERENCE_SHEET_NAME


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

# fresh token file for Sheets (prevents reusing an old read-only token)
TOKEN_PATH = "token_sheets.json"


def get_sheets_client():
    creds = None
    required_scopes = set(SCOPES)

    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    def need_reauth(c):
        if not c or not c.valid:
            return True
        current = set(c.scopes or [])
        return not required_scopes.issubset(current)

    if need_reauth(creds):
        if creds and creds.expired and creds.refresh_token and required_scopes.issubset(
            set(creds.scopes or [])
        ):
            try:
                creds.refresh(Request())
            except Exception as e:
                # Token refresh failed (expired/revoked), delete old token and re-authenticate
                print(f"Token refresh failed: {e}. Re-authenticating...")
                if os.path.exists(TOKEN_PATH):
                    os.remove(TOKEN_PATH)
                flow = InstalledAppFlow.from_client_secrets_file(GOOGLE_CREDENTIALS_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            flow = InstalledAppFlow.from_client_secrets_file(GOOGLE_CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())

    # optional: quick visibility
    # print("Google creds scopes:", creds.scopes)

    gc = gspread.authorize(creds)
    return gc


def read_and_print_sheet():
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    worksheet = sh.worksheet(SHEET_NAME)
    all_values = worksheet.get_all_values()
    print("Current Google Sheet values:")
    for row in all_values:
        print(row)
    return all_values


def upsert_reference_values(values_dict_list_or_single):
    """
    Create (if missing) and upsert metric reference rows in a dedicated sheet.
    - Sheet name comes from REFERENCE_SHEET_NAME
    - Columns: [metric, unit, low, high]
    - Only appends rows for metrics not already present
    - Performs at most one read and one write
    values_dict_list_or_single: dict or list[dict] with shape {tests: {metric: {unit, ref_low, ref_high}}}
    """
    # Normalize input to a list
    if isinstance(values_dict_list_or_single, dict):
        updates = [values_dict_list_or_single]
    else:
        updates = list(values_dict_list_or_single or [])

    # Aggregate candidate refs from incoming updates
    candidates = {}
    for vd in updates:
        tests = (vd or {}).get("tests", {})
        for metric, obj in tests.items():
            # Expect optional reference info if present
            low = obj.get("ref_low") or obj.get("low")
            high = obj.get("ref_high") or obj.get("high")
            unit = obj.get("unit")
            if low is None and high is None:
                # skip metrics without any reference range info
                continue
            # Prefer first-seen reference for a metric; do not override
            if metric not in candidates:
                candidates[metric] = {
                    "metric": metric,
                    "unit": unit or "",
                    "low": low if low is not None else "",
                    "high": high if high is not None else "",
                }

    if not candidates:
        return  # nothing to do

    # Open sheet and get or create reference worksheet
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    try:
        ref_ws = sh.worksheet(REFERENCE_SHEET_NAME)
    except gspread.exceptions.WorksheetNotFound:
        ref_ws = sh.add_worksheet(title=REFERENCE_SHEET_NAME, rows="500", cols="10")
        # seed header immediately to avoid second write later if empty
        ref_ws.update("A1", [["metric", "unit", "low", "high"]])

    # Single read of current refs
    existing = ref_ws.get_all_values()
    if not existing:
        existing = [["metric", "unit", "low", "high"]]

    # Normalize width and header
    width = max(len(r) for r in existing)
    existing = [r + [""] * (width - len(r)) for r in existing]
    header = existing[0]
    # Align columns to expected schema
    expected = ["metric", "unit", "low", "high"]
    # If header is not correct, reset to expected while preserving data below where possible
    if [h.lower() for h in header[:4]] != expected:
        header = ["metric", "unit", "low", "high"]
        existing[0] = header

    # Build set of existing metrics
    existing_metrics = set()
    for i in range(1, len(existing)):
        name = (existing[i][0] or "").strip()
        if name:
            existing_metrics.add(name)

    # Determine new rows to append
    rows_to_append = []
    for metric, row in candidates.items():
        if metric in existing_metrics:
            continue
        rows_to_append.append([row["metric"], row["unit"], row["low"], row["high"]])

    if not rows_to_append:
        return

    # Perform a single append batch write
    # If the sheet currently only has header, start from row 2; otherwise just append
    ref_ws.append_rows(rows_to_append, value_input_option="USER_ENTERED")

def update_sheet_with_values2(values_dict):
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    worksheet = sh.worksheet(SHEET_NAME)
    headers = worksheet.row_values(1)
    all_rows = worksheet.get_all_records()
    # Check if this test already exists (by a unique key, e.g. first column or test name)
    # Here, we assume 'tests' dict with test names as keys
    new_tests = values_dict.get("tests", {})
    existing_names = set()
    for row in all_rows:
        existing_names.update(row.keys())
    to_add = {}
    for test_name, test_data in new_tests.items():
        if test_name not in existing_names:
            to_add[test_name] = test_data
    if not to_add:
        print("No new tests to add.")
        return
    # Append new rows for each new test
    for test_name, test_data in to_add.items():
        row = [test_name]
        for h in headers[1:]:
            row.append(test_data.get(h, ""))
        worksheet.append_row(row)
        print(f"Added new test: {test_name}")


def update_sheet_with_values(values_dict):
    """Upsert values into a wide sheet:
       A1='metric', B1..=dates 'YYYY-MM-DD'
       One row per metric; one column per sample_date.
    """
    import re

    sample_date = values_dict.get("sample_date")
    tests = values_dict.get("tests", {})
    if not sample_date or not tests:
        print("Nothing to write (missing sample_date or tests).")
        return

    # 1) Open sheet
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    ws = sh.worksheet(SHEET_NAME)

    # Also upsert reference values (single read+write internally)
    try:
        upsert_reference_values(values_dict)
    except Exception as e:
        print(f"Reference upsert skipped: {e}")

    # 2) Read all values (2D list) and normalize width
    data = ws.get_all_values()
    if not data:
        data = [["metric"]]
    width = max(len(r) for r in data)
    data = [r + [""] * (width - len(r)) for r in data]

    # Header fix
    header = data[0]
    if not header or header[0].lower() != "metric":
        header = ["metric"] + header[1:]
        data[0] = header

    # 3) Ensure the date column exists
    if sample_date not in header:
        header.append(sample_date)
        for i in range(1, len(data)):
            data[i].append("")

    # Recompute width after possible append
    width = len(header)
    data = [r + [""] * (width - len(r)) for r in data]

    # 4) Build metric→row map; create rows if missing
    row_index = {}
    for i in range(1, len(data)):
        name = (data[i][0] or "").strip()
        if name:
            row_index[name] = i
    for metric in tests.keys():
        if metric not in row_index:
            new_row = [""] * width
            new_row[0] = metric
            data.append(new_row)
            row_index[metric] = len(data) - 1

    # 5) Write the values (skip if identical)
    date_col = header.index(sample_date)
    updated, skipped = 0, 0
    for metric, obj in tests.items():
        val = obj.get("value")
        if val is None:
            continue
        i = row_index[metric]
        cur = data[i][date_col]
        same = False
        try:
            same = (cur != "") and (float(cur) == float(val))
        except Exception:
            same = str(cur).strip() == str(val)
        if same:
            skipped += 1
            continue
        data[i][date_col] = str(val)
        updated += 1

    # 6) Sort date columns ascending (left→right), keep 'metric' first
    def is_date(s: str) -> bool:
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", s or ""))

    date_idxs = [(j, c) for j, c in enumerate(header) if j > 0 and is_date(c)]
    date_order = [j for j, _ in sorted(date_idxs, key=lambda x: x[1])]
    other = [j for j in range(1, len(header)) if j not in date_order]
    order = [0] + date_order + other

    header = [header[j] for j in order]
    new_data = [header]
    for i in range(1, len(data)):
        new_data.append([data[i][j] for j in order])

    # 7) Push back (single batch update) only if there are changes
    if updated > 0:
        ws.clear()
        ws.update("A1", new_data, value_input_option="USER_ENTERED")
        print(f"Sheet upsert complete for {sample_date}: {updated} cells updated, {skipped} skipped.")
    else:
        print(f"No changes for {sample_date}: {skipped} skipped, nothing updated.")

def read_sheet_data():
    """
    Reads the entire sheet and returns a 2D list (data) and header row.
    Also returns the original row order (metric names) to preserve user's sorting.
    """
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    ws = sh.worksheet(SHEET_NAME)
    data = ws.get_all_values()
    if not data:
        data = [["metric"]]
    width = max(len(r) for r in data)
    data = [r + [""] * (width - len(r)) for r in data]

    # Capture original row order (metric names) to preserve user's sorting
    original_row_order = [(data[i][0] or "").strip() for i in range(1, len(data)) if (data[i][0] or "").strip()]

    return data, original_row_order


def _sort_rows_by_original_order(data, original_row_order):
    """
    Sort data rows to match the original row order.
    New metrics (not in original order) are appended at the end.
    """
    if not data or len(data) < 2:
        return data

    header = data[0]
    rows = data[1:]

    # Build order map: metric_name -> position
    order_map = {name: idx for idx, name in enumerate(original_row_order)}

    # Sort rows: original metrics in their original order, new ones at the end
    def sort_key(row):
        metric = (row[0] or "").strip()
        if metric in order_map:
            return (0, order_map[metric])  # Original metrics first, in original order
        return (1, metric.lower())  # New metrics at end, sorted alphabetically

    sorted_rows = sorted(rows, key=sort_key)

    return [header] + sorted_rows

def batch_update_sheet(sheet_data, updates, original_row_order=None):
    """
    Applies a list of values_dicts (from extract_labs_from_pdf) to the in-memory sheet_data, then writes back once.
    Preserves the original row order (user's sorting preferences) when writing back.
    """
    import re
    data = sheet_data
    header = data[0]
    if not header or header[0].lower() != "metric":
        header = ["metric"] + header[1:]
        data[0] = header
    width = len(header)
    data = [r + [""] * (width - len(r)) for r in data]
    row_index = { (data[i][0] or "").strip(): i for i in range(1, len(data)) if (data[i][0] or "").strip() }

    # upfront: ensure reference sheet is updated using all updates in one go
    try:
        upsert_reference_values(updates)
    except Exception as e:
        print(f"Reference upsert skipped: {e}")

    updated, skipped = 0, 0
    for values_dict in updates:
        sample_date = values_dict.get("sample_date")
        tests = values_dict.get("tests", {})
        if not sample_date or not tests:
            continue
        # Ensure date column exists
        if sample_date not in header:
            header.append(sample_date)
            for i in range(1, len(data)):
                data[i].append("")
        width = len(header)
        data = [r + [""] * (width - len(r)) for r in data]
        # Ensure metric rows exist
        for metric in tests.keys():
            if metric not in row_index:
                new_row = [""] * width
                new_row[0] = metric
                data.append(new_row)
                row_index[metric] = len(data) - 1
        # Write values
        date_col = header.index(sample_date)
        for metric, obj in tests.items():
            val = obj.get("value")
            if val is None:
                continue
            i = row_index[metric]
            cur = data[i][date_col]
            same = False
            try:
                same = (cur != "") and (float(cur) == float(val))
            except Exception:
                same = str(cur).strip() == str(val)
            if same:
                skipped += 1
                continue
            data[i][date_col] = str(val)
            updated += 1
    # Sort date columns ascending (left→right), keep 'metric' first
    def is_date(s: str) -> bool:
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", s or ""))
    date_idxs = [(j, c) for j, c in enumerate(header) if j > 0 and is_date(c)]
    date_order = [j for j, _ in sorted(date_idxs, key=lambda x: x[1])]
    other = [j for j in range(1, len(header)) if j not in date_order]
    order = [0] + date_order + other
    header = [header[j] for j in order]
    new_data = [header]
    for i in range(1, len(data)):
        new_data.append([data[i][j] for j in order])

    # Preserve original row order (user's sorting preferences)
    if original_row_order:
        new_data = _sort_rows_by_original_order(new_data, original_row_order)
        print(f"Preserved original row order ({len(original_row_order)} metrics).")

    # Only update if there are changes
    if updated > 0:
        gc = get_sheets_client()
        sh = gc.open_by_key(SHEET_ID)
        ws = sh.worksheet(SHEET_NAME)
        ws.clear()
        ws.update("A1", new_data, value_input_option="USER_ENTERED")
        print(f"Batch sheet upsert complete: {updated} cells updated, {skipped} skipped.")
    else:
        print(f"Batch update: {skipped} skipped, nothing updated.")

def get_all_metric_names():
    """
    Read the sheet and return all unique metric names (first column values, excluding header).
    """
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    ws = sh.worksheet(SHEET_NAME)
    data = ws.get_all_values()
    if not data or len(data) < 2:
        return []
    # Skip header row (data[0]), collect first column
    metrics = [row[0].strip() for row in data[1:] if row and row[0].strip()]
    return list(set(metrics))  # deduplicate

# Static mapping for known typos and variations that should ALWAYS be merged
# Format: "wrong_name" -> "correct_name"
# Add known typos here as you discover them
STATIC_TYPO_CORRECTIONS = {
    # Sedimantasyon variants
    "SEDİMENTASYON": "Sedimantasyon",
    "Sedimentasyon": "Sedimantasyon",
    "SEDIMENTASYON": "Sedimantasyon",

    # Hemoglobin variants
    "HGB": "Hemoglobin",
    "Hgb": "Hemoglobin",

    # CRP variants -> merge to C-reaktif Protein
    "CRP": "C-reaktif Protein",
    "Crp (Turbidimetrik)": "C-reaktif Protein",
    "CRP Türbidimetrik": "C-reaktif Protein",
    "Crp (Türbidimetrik)": "C-reaktif Protein",

    # Add more known typos/variations here as needed:
    # "TypoName": "CorrectName",
}


def _auto_detect_synonyms(metric_names):
    """
    Automatically detect obvious synonyms without relying on AI.
    Rules:
    1. Base name without suffix should merge to # variant (e.g., Lenfosit -> Lenfosit#)
    2. Case-insensitive matches should merge to the more common form
    3. Common medical abbreviations
    """
    auto_map = {}
    metric_set = set(metric_names)
    metric_lower_map = {m.lower(): m for m in metric_names}

    # Rule 1: Merge base names to their # variants
    # e.g., "Lenfosit" should merge to "Lenfosit#" if both exist
    for metric in metric_names:
        if not metric.endswith('#') and not metric.endswith('%'):
            hash_variant = metric + "#"
            if hash_variant in metric_set:
                auto_map[metric] = hash_variant
                print(f"  Auto-detect: '{metric}' → '{hash_variant}' (base→# rule)")

    # Rule 2: Common medical abbreviations (bidirectional check)
    COMMON_ABBREVIATIONS = {
        "HGB": "Hemoglobin",
        "Hgb": "Hemoglobin",
        "PLT": "Trombosit",
        "WBC": "Lökosit",
        "RBC": "Eritrosit",
        "HCT": "Hematokrit",
        "Hct": "Hematokrit",
        "MCV": "MCV",
        "MCH": "MCH",
        "MCHC": "MCHC",
        "NEU#": "Nötrofil#",
        "NEU%": "Nötrofil%",
        "LYM#": "Lenfosit#",
        "LYM%": "Lenfosit%",
        "MON#": "Monosit#",
        "MON%": "Monosit%",
        "EOS#": "Eozinofil#",
        "EOS%": "Eozinofil%",
        "BASO#": "Bazofil#",
        "BASO%": "Bazofil%",
        "ALT": "Alanin aminotransferaz",
        "AST": "Aspartat transaminaz",
        "GGT": "GGT - Gamma glutamil transferaz",
        "ALP": "Alkalen Fosfataz",
        "BUN": "Kan Üre Azotu",
        "CRP": "C-reaktif Protein",
        "TSH": "TSH",
        "LDH": "LDH - Laktik Dehidrogenaz",
    }

    for abbrev, full_name in COMMON_ABBREVIATIONS.items():
        if abbrev in metric_set and full_name in metric_set:
            auto_map[abbrev] = full_name
            print(f"  Auto-detect: '{abbrev}' → '{full_name}' (abbreviation rule)")

    # Rule 3: Case-insensitive duplicates (merge to title case or existing)
    seen_lower = {}
    for metric in metric_names:
        lower = metric.lower()
        if lower in seen_lower:
            existing = seen_lower[lower]
            # Prefer the one that's not all caps
            if metric.isupper() and not existing.isupper():
                auto_map[metric] = existing
                print(f"  Auto-detect: '{metric}' → '{existing}' (case rule)")
            elif not metric.isupper() and existing.isupper():
                auto_map[existing] = metric
                print(f"  Auto-detect: '{existing}' → '{metric}' (case rule)")
        else:
            seen_lower[lower] = metric

    return auto_map


def get_static_synonym_map(metric_names):
    """
    Returns a synonym map based on static typo corrections.
    Only returns mappings for metrics that actually exist in the sheet.
    """
    static_map = {}
    metric_set = set(metric_names)

    for typo, correct in STATIC_TYPO_CORRECTIONS.items():
        if typo in metric_set:
            static_map[typo] = correct
            print(f"  Static correction: '{typo}' → '{correct}'")

    return static_map


def identify_synonyms(metric_names):
    """
    Identify synonym metrics using rule-based detection and static corrections.
    No AI calls - faster and more reliable.

    Returns a dict mapping original_name -> unified_name.
    """
    if not metric_names:
        return {}

    print(f"Identifying synonyms for {len(metric_names)} metrics...")

    # First, apply static typo corrections
    static_map = get_static_synonym_map(metric_names)
    if static_map:
        print(f"Applied {len(static_map)} static typo corrections.")

    # Second, apply automatic rule-based detection
    auto_map = _auto_detect_synonyms(metric_names)
    if auto_map:
        print(f"Applied {len(auto_map)} auto-detected synonyms.")

    # Merge: auto < static (static takes precedence)
    final_map = {**auto_map, **static_map}
    print(f"Final synonym map: {len(final_map)} mappings ({len(static_map)} static + {len(auto_map)} auto)")

    return final_map


def identify_synonyms_with_ai(metric_names):
    """
    DEPRECATED: Use identify_synonyms() instead.
    This function now just calls identify_synonyms() without AI.
    Kept for backwards compatibility.
    """
    return identify_synonyms(metric_names)


def _validate_synonym_mappings(synonym_map):
    """
    Validates synonym mappings to prevent merging incompatible metrics.

    Rules:
    1. Metrics with # vs % suffixes are NEVER merged (different units, different ref ranges)
    2. Metrics with different reference ranges are NOT merged

    Returns:
        A filtered synonym_map with only valid merges
    """
    if not synonym_map:
        return {}

    print(f"Validating {len(synonym_map)} synonym mappings...")

    # Get reference ranges from the reference sheet
    try:
        gc = get_sheets_client()
        sh = gc.open_by_key(SHEET_ID)
        ref_ws = sh.worksheet(REFERENCE_SHEET_NAME)
        ref_data = ref_ws.get_all_values()

        # Build map: metric_name -> (low, high)
        ref_ranges = {}
        if ref_data and len(ref_data) > 1:
            for i in range(1, len(ref_data)):
                if len(ref_data[i]) >= 4:
                    metric = ref_data[i][0].strip()
                    low = ref_data[i][2].strip()
                    high = ref_data[i][3].strip()
                    if metric:
                        ref_ranges[metric] = (low, high)

        print(f"Loaded {len(ref_ranges)} reference ranges")
    except Exception as e:
        print(f"Warning: Could not load reference ranges: {e}")
        ref_ranges = {}

    # Group by unified name to check compatibility
    groups = {}
    for original, unified in synonym_map.items():
        if unified not in groups:
            groups[unified] = []
        groups[unified].append(original)

    validated_map = {}

    for unified_name, original_names in groups.items():
        # Rule 1: Check for # vs % suffix conflicts
        has_hash = any(name.endswith('#') for name in original_names)
        has_percent = any(name.endswith('%') for name in original_names)

        if has_hash and has_percent:
            print(f"❌ Rejecting merge: '{unified_name}' group contains both # and % metrics: {original_names}")
            continue

        # Rule 2: Check reference range compatibility (LENIENT - only for major conflicts)
        # Allow minor variations between labs (e.g., 50 vs 55 is OK)
        # Only reject if ranges are VERY different (e.g., 5 vs 50)
        ranges_in_group = []
        for name in original_names:
            if name in ref_ranges:
                ranges_in_group.append((name, ref_ranges[name]))

        if len(ranges_in_group) > 1:
            # Parse ranges and check for major conflicts
            def parse_range(rng_tuple):
                """Parse range tuple to floats, return None if invalid"""
                try:
                    low = float(rng_tuple[0]) if rng_tuple[0] else None
                    high = float(rng_tuple[1]) if rng_tuple[1] else None
                    return (low, high)
                except (ValueError, TypeError):
                    return None

            parsed_ranges = [(name, parse_range(rng)) for name, rng in ranges_in_group]
            parsed_ranges = [(n, r) for n, r in parsed_ranges if r is not None]

            if len(parsed_ranges) > 1:
                # Check if high values differ by more than 50% (major conflict)
                high_values = [r[1] for _, r in parsed_ranges if r[1] is not None]
                if len(high_values) > 1:
                    max_high = max(high_values)
                    min_high = min(high_values)
                    if max_high > 0 and (max_high / min_high) > 2.0:  # More than 2x difference
                        print(f"⚠️  Warning: '{unified_name}' has significantly different reference ranges:")
                        for name, rng in ranges_in_group:
                            print(f"   - {name}: {rng}")
                        print(f"   → Merging anyway (minor lab variations are normal)")
                    # Otherwise, allow merge even with small differences

        # Rule 3: Only prevent merging when base metric mixes with BOTH # AND % variants
        # (e.g., reject ["Nötrofil", "Nötrofil#", "Nötrofil%"] but allow ["Nötrofil", "Nötrofil#"])
        base_names = [n.rstrip('#%') for n in original_names]
        if len(set(base_names)) == 1 and len(original_names) > 1:
            # All have the same base name
            has_hash = any(n.endswith('#') for n in original_names)
            has_percent = any(n.endswith('%') for n in original_names)
            has_no_suffix = any(not n.endswith('#') and not n.endswith('%') for n in original_names)

            # Only reject if base metric is mixed with BOTH # AND % (already caught by Rule 1)
            # Allow merging base with only # (if same ref range) or only % (if same ref range)
            if has_no_suffix and has_hash and has_percent:
                print(f"❌ Rejecting merge: Base metric mixed with both # and % variants: {original_names}")
                continue

        # All checks passed, add to validated map
        for original in original_names:
            validated_map[original] = unified_name

    print(f"✓ Validated {len(validated_map)} mappings (rejected {len(synonym_map) - len(validated_map)})")
    return validated_map

def consolidate_columns(synonym_map, original_row_order=None):
    """
    Consolidate duplicate columns based on the synonym mapping.
    For each group of synonyms:
    1. Merge all values into the unified column in the data sheet
    2. Delete the duplicate columns
    3. Preserve all data (when multiple synonyms have values for the same date, keep the first non-empty value)
    4. Also consolidate the reference sheet to match

    Args:
        synonym_map: dict mapping original_name -> unified_name
        original_row_order: optional list of metric names in the order they should be preserved.
                           If not provided, captures current order from the sheet.

    IMPORTANT: Before merging, validates that metrics have compatible reference ranges.
    Metrics with # vs % suffixes or different reference ranges will NOT be merged.
    """
    if not synonym_map:
        print("No synonym mappings to consolidate.")
        return

    print(f"Starting consolidation with {len(synonym_map)} mappings...")

    # Validate synonym mappings before consolidating
    validated_synonym_map = _validate_synonym_mappings(synonym_map)
    if len(validated_synonym_map) < len(synonym_map):
        rejected = len(synonym_map) - len(validated_synonym_map)
        print(f"⚠️  Rejected {rejected} mappings due to incompatible reference ranges or # vs % suffixes")

    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)

    # === Consolidate DATA sheet ===
    ws = sh.worksheet(SHEET_NAME)
    data = ws.get_all_values()

    if not data:
        return

    # Normalize width
    width = max(len(r) for r in data)
    data = [r + [""] * (width - len(r)) for r in data]

    header = data[0]

    # Use provided original_row_order if available, otherwise capture from current sheet
    if original_row_order is None:
        original_row_order = [(data[i][0] or "").strip() for i in range(1, len(data)) if (data[i][0] or "").strip()]
        print(f"Captured current row order ({len(original_row_order)} metrics)")
    else:
        print(f"Using provided row order ({len(original_row_order)} metrics)")

    # Build metric -> row index map
    row_index = {}
    for i in range(1, len(data)):
        metric = (data[i][0] or "").strip()
        if metric:
            row_index[metric] = i

    print(f"Found {len(row_index)} metrics in data sheet: {list(row_index.keys())[:10]}...")

    # Group synonyms by unified name
    # unified_name -> [original_name1, original_name2, ...]
    groups = {}
    for original, unified in validated_synonym_map.items():
        if unified not in groups:
            groups[unified] = []
        groups[unified].append(original)

    print(f"Grouped into {len(groups)} unified names: {list(groups.keys())[:10]}...")

    # For each group, merge data
    for unified_name, original_names in groups.items():
        # Find which names actually exist in the sheet
        existing = [name for name in original_names if name in row_index]

        if not existing:
            continue

        # Ensure unified row exists
        if unified_name not in row_index:
            # Create new row for unified name
            new_row = [""] * width
            new_row[0] = unified_name
            data.append(new_row)
            row_index[unified_name] = len(data) - 1

        unified_idx = row_index[unified_name]

        # Merge data from all synonym rows into unified row
        for orig_name in existing:
            if orig_name == unified_name:
                continue  # Skip if it's already the unified name

            orig_idx = row_index[orig_name]

            # For each column (skip metric column), merge values
            for col in range(1, len(data[orig_idx])):
                orig_val = data[orig_idx][col].strip()
                unified_val = data[unified_idx][col].strip()

                # If unified row is empty but original has value, copy it
                if not unified_val and orig_val:
                    data[unified_idx][col] = orig_val

    # Remove duplicate rows (keep unified, remove originals that were merged)
    rows_to_remove = set()
    for unified_name, original_names in groups.items():
        for orig_name in original_names:
            if orig_name != unified_name and orig_name in row_index:
                rows_to_remove.add(row_index[orig_name])

    # Build new data without removed rows
    new_data = [data[0]]  # Keep header
    for i in range(1, len(data)):
        if i not in rows_to_remove:
            new_data.append(data[i])

    # Preserve original row order (user's sorting preferences)
    # Map old metric names to new unified names for proper ordering
    metric_remap = {}
    for unified_name, original_names in groups.items():
        for orig_name in original_names:
            if orig_name != unified_name:
                metric_remap[orig_name] = unified_name

    # Update original_row_order to use unified names where applicable
    updated_row_order = []
    seen_unified = set()
    for metric in original_row_order:
        unified = metric_remap.get(metric, metric)
        if unified not in seen_unified:
            updated_row_order.append(unified)
            seen_unified.add(unified)

    new_data = _sort_rows_by_original_order(new_data, updated_row_order)
    print(f"Preserved original row order ({len(updated_row_order)} metrics).")

    # Write back to data sheet
    ws.clear()
    ws.update("A1", new_data, value_input_option="USER_ENTERED")
    print(f"Data sheet: Consolidated {len(rows_to_remove)} duplicate metric rows.")

    # === Consolidate REFERENCE sheet ===
    try:
        ref_ws = sh.worksheet(REFERENCE_SHEET_NAME)
    except gspread.exceptions.WorksheetNotFound:
        print("Reference sheet not found, skipping reference consolidation.")
        return

    ref_data = ref_ws.get_all_values()
    if not ref_data or len(ref_data) < 2:
        print("Reference sheet is empty, skipping reference consolidation.")
        return

    # Normalize width
    ref_width = max(len(r) for r in ref_data)
    ref_data = [r + [""] * (ref_width - len(r)) for r in ref_data]

    # Build metric -> row index map for reference sheet
    ref_row_index = {}
    for i in range(1, len(ref_data)):
        metric = (ref_data[i][0] or "").strip()
        if metric:
            ref_row_index[metric] = i

    print(f"Found {len(ref_row_index)} metrics in reference sheet: {list(ref_row_index.keys())[:10]}...")

    # For each group, merge reference data
    for unified_name, original_names in groups.items():
        existing_refs = [name for name in original_names if name in ref_row_index]

        if not existing_refs:
            continue

        # Ensure unified row exists in reference sheet
        if unified_name not in ref_row_index:
            # Create new row for unified name
            new_row = [""] * ref_width
            new_row[0] = unified_name
            ref_data.append(new_row)
            ref_row_index[unified_name] = len(ref_data) - 1

        unified_idx = ref_row_index[unified_name]

        # Merge reference values from all synonym rows
        for orig_name in existing_refs:
            if orig_name == unified_name:
                continue

            orig_idx = ref_row_index[orig_name]

            # Merge unit, low, high values (columns 1, 2, 3)
            for col in range(1, min(4, len(ref_data[orig_idx]))):
                orig_val = ref_data[orig_idx][col].strip()
                unified_val = ref_data[unified_idx][col].strip()

                # If unified row is empty but original has value, copy it
                if not unified_val and orig_val:
                    ref_data[unified_idx][col] = orig_val

    # Remove duplicate rows from reference sheet
    ref_rows_to_remove = set()
    for unified_name, original_names in groups.items():
        for orig_name in original_names:
            if orig_name != unified_name and orig_name in ref_row_index:
                ref_rows_to_remove.add(ref_row_index[orig_name])

    # Build new reference data without removed rows
    new_ref_data = [ref_data[0]]  # Keep header
    for i in range(1, len(ref_data)):
        if i not in ref_rows_to_remove:
            new_ref_data.append(ref_data[i])

    # Write back to reference sheet
    ref_ws.clear()
    ref_ws.update("A1", new_ref_data, value_input_option="USER_ENTERED")
    print(f"Reference sheet: Consolidated {len(ref_rows_to_remove)} duplicate metric rows.")
    print(f"Total consolidation complete!")

def rebuild_pivot_sheet(source_ws_name=SHEET_NAME, target_ws_name=LOOKER_SHEET_NAME):
    """
    Read the wide sheet (rows=metrics, columns=YYYY-MM-DD) and rebuild a pivot
    sheet in the format:
        Date | Hemoglobin | Trombosit | ...    (one row per date)
    The target sheet is created/cleared and fully overwritten.
    """

    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)

    # --- read source (wide) ---
    src = sh.worksheet(source_ws_name)
    values = src.get_all_values()
    if not values:
        print("Source sheet is empty.")
        return

    header = values[0]
    if not header or header[0].lower() != "metric":
        header[0] = "metric"
    df = pd.DataFrame(values[1:], columns=header)

    # index by metric, transpose to dates-as-rows
    if "metric" not in df.columns:
        raise ValueError("First column must be 'metric'.")
    df.set_index("metric", inplace=True, drop=False)
    df_t = df.drop(columns=["metric"]).T  # rows become dates

    # turn index into a 'Date' column and sort ascending
    df_t.index.name = "Date"
    df_t.reset_index(inplace=True)

    def _fmt_date(s: str) -> str:
        for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(s.strip(), fmt).strftime("%m/%d/%Y")
            except Exception:
                continue
        return s  # leave as-is if not parsable

    df_t["Date"] = df_t["Date"].apply(_fmt_date)
    df_t["_sort"] = pd.to_datetime(df_t["Date"], errors="coerce", format="%m/%d/%Y")
    df_t = df_t.sort_values("_sort").drop(columns=["_sort"])

    # replace NaN with empty strings (Sheets friendly)
    df_out = df_t.fillna("")

    # --- write target (pivot) ---
    try:
        tgt = sh.worksheet(target_ws_name)
    except gspread.exceptions.WorksheetNotFound:
        tgt = sh.add_worksheet(title=target_ws_name, rows="100", cols="26")

    tgt.clear()
    tgt.update("A1",
               [df_out.columns.tolist()] + df_out.astype(object).values.tolist(),
               value_input_option="USER_ENTERED")

    print(f"Pivot rebuilt → '{target_ws_name}' with {len(df_out)} rows, {len(df_out.columns)} columns.")
