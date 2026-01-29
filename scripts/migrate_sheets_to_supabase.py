#!/usr/bin/env python3
"""
Migrate existing data from Google Sheets to Supabase.

This script:
1. Reads data from the Google Sheet (wide format: metrics as rows, dates as columns)
2. Reads reference values from the Reference sheet
3. Creates a profile for the patient in Supabase
4. Creates reports and metrics for each date/metric combination
5. Is idempotent - can be run multiple times safely

Usage:
    python scripts/migrate_sheets_to_supabase.py [--dry-run]
"""

import argparse
import os
import sys
from datetime import datetime
from typing import Optional

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.sheets_updater import get_sheets_client
from src.config import SHEET_ID, SHEET_NAME, REFERENCE_SHEET_NAME
from src.supabase_client import get_supabase_client


# Placeholder profile name for migrated data
MIGRATED_PROFILE_NAME = "Father (Migrated)"


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse a date string into ISO format (YYYY-MM-DD).
    Handles various formats from Google Sheets.
    """
    if not date_str or not date_str.strip():
        return None

    date_str = date_str.strip()

    # Try different date formats
    formats = [
        "%Y-%m-%d",      # ISO format
        "%m/%d/%Y",      # US format
        "%d/%m/%Y",      # EU format
        "%Y/%m/%d",      # Alternative ISO
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    print(f"  Warning: Could not parse date '{date_str}'")
    return None


def parse_numeric(value: str) -> Optional[float]:
    """Parse a numeric value, handling various formats."""
    if not value or not str(value).strip():
        return None

    value_str = str(value).strip()

    # Handle comma as decimal separator
    value_str = value_str.replace(",", ".")

    # Remove any non-numeric characters except . and -
    try:
        return float(value_str)
    except ValueError:
        return None


def read_sheet_data():
    """Read the main data sheet (wide format)."""
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    worksheet = sh.worksheet(SHEET_NAME)
    return worksheet.get_all_values()


def read_reference_data():
    """Read the reference values sheet."""
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    try:
        ref_ws = sh.worksheet(REFERENCE_SHEET_NAME)
        return ref_ws.get_all_values()
    except Exception:
        print("  Warning: Reference sheet not found, proceeding without reference values")
        return []


def get_or_create_profile(client, profile_name: str, dry_run: bool = False) -> Optional[str]:
    """
    Get or create a profile by name.
    Returns the profile ID.
    """
    # Check if profile exists
    result = client.table("profiles").select("id").eq("display_name", profile_name).execute()

    if result.data:
        return result.data[0]["id"]

    if dry_run:
        print(f"  [DRY RUN] Would create profile: {profile_name}")
        return "dry-run-profile-id"

    # Create new profile
    result = client.table("profiles").insert({
        "display_name": profile_name,
        "owner_user_id": None  # Will be claimed later by authenticated user
    }).execute()

    return result.data[0]["id"]


def get_or_create_report(client, profile_id: str, sample_date: str, dry_run: bool = False) -> Optional[str]:
    """
    Get or create a report for a profile/date.
    Returns the report ID.
    """
    # Check if report exists
    result = client.table("reports").select("id").eq("profile_id", profile_id).eq("sample_date", sample_date).execute()

    if result.data:
        return result.data[0]["id"]

    if dry_run:
        print(f"  [DRY RUN] Would create report: {sample_date}")
        return "dry-run-report-id"

    # Create new report
    result = client.table("reports").insert({
        "profile_id": profile_id,
        "sample_date": sample_date,
        "source": "migrated"
    }).execute()

    return result.data[0]["id"]


def upsert_metric(client, report_id: str, name: str, value: float,
                  unit: Optional[str], ref_low: Optional[float], ref_high: Optional[float],
                  dry_run: bool = False) -> bool:
    """
    Insert or update a metric for a report.
    Returns True if successful.
    """
    if dry_run:
        return True

    # Use upsert with the unique constraint on (report_id, name)
    result = client.table("metrics").upsert({
        "report_id": report_id,
        "name": name,
        "value": value,
        "unit": unit,
        "ref_low": ref_low,
        "ref_high": ref_high,
    }, on_conflict="report_id,name").execute()

    return bool(result.data)


def migrate(dry_run: bool = False):
    """Main migration function."""
    print("=" * 60)
    print("ViziAI Google Sheets to Supabase Migration")
    print("=" * 60)

    if dry_run:
        print("\n[DRY RUN MODE - No data will be written]\n")

    # 1. Read data from Google Sheets
    print("\n1. Reading data from Google Sheets...")
    data = read_sheet_data()
    if not data or len(data) < 2:
        print("  Error: No data found in sheet")
        return

    print(f"  Found {len(data) - 1} metrics")

    # 2. Read reference values
    print("\n2. Reading reference values...")
    ref_data = read_reference_data()
    references = {}
    if ref_data and len(ref_data) > 1:
        # Skip header row
        for row in ref_data[1:]:
            if len(row) >= 1 and row[0]:
                metric_name = row[0].strip()
                references[metric_name] = {
                    "unit": row[1].strip() if len(row) > 1 else None,
                    "ref_low": parse_numeric(row[2]) if len(row) > 2 else None,
                    "ref_high": parse_numeric(row[3]) if len(row) > 3 else None,
                }
        print(f"  Found reference values for {len(references)} metrics")
    else:
        print("  No reference values found")

    # 3. Parse the wide format
    print("\n3. Parsing sheet data...")
    header = data[0]
    dates = []
    for i, cell in enumerate(header[1:], start=1):
        parsed = parse_date(cell)
        if parsed:
            dates.append((i, parsed))

    print(f"  Found {len(dates)} date columns")

    # 4. Connect to Supabase
    print("\n4. Connecting to Supabase...")
    client = get_supabase_client()
    print("  Connected successfully")

    # 5. Create or get profile
    print("\n5. Creating/getting profile...")
    profile_id = get_or_create_profile(client, MIGRATED_PROFILE_NAME, dry_run)
    print(f"  Profile ID: {profile_id}")

    # 6. Migrate data
    print("\n6. Migrating data...")
    reports_created = 0
    metrics_created = 0
    errors = 0

    for col_idx, sample_date in dates:
        # Create or get report for this date
        report_id = get_or_create_report(client, profile_id, sample_date, dry_run)
        if report_id:
            reports_created += 1

        # Process each metric row
        for row in data[1:]:
            if not row or not row[0]:
                continue

            metric_name = row[0].strip()
            if not metric_name or metric_name.lower() == "metric":
                continue

            # Get value for this date
            if col_idx >= len(row):
                continue

            value = parse_numeric(row[col_idx])
            if value is None:
                continue

            # Get reference values
            ref = references.get(metric_name, {})
            unit = ref.get("unit")
            ref_low = ref.get("ref_low")
            ref_high = ref.get("ref_high")

            # Insert metric
            try:
                if upsert_metric(client, report_id, metric_name, value, unit, ref_low, ref_high, dry_run):
                    metrics_created += 1
                else:
                    errors += 1
            except Exception as e:
                print(f"  Error inserting {metric_name} for {sample_date}: {e}")
                errors += 1

    # 7. Print summary
    print("\n" + "=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"  Reports created/found: {reports_created}")
    print(f"  Metrics upserted: {metrics_created}")
    if errors:
        print(f"  Errors: {errors}")
    print()

    if dry_run:
        print("This was a DRY RUN. No data was written to Supabase.")
        print("Run without --dry-run to perform the actual migration.")
    else:
        print("Migration complete!")


def main():
    parser = argparse.ArgumentParser(description="Migrate Google Sheets data to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    try:
        migrate(dry_run=args.dry_run)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
