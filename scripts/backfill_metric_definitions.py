#!/usr/bin/env python3
"""
Backfill metric_definitions from existing metrics data.

This script populates the metric_definitions table by:
1. Getting all distinct metric names from the metrics table
2. For each metric, finding the most common reference values
3. Upserting into metric_definitions

This is idempotent - safe to run multiple times.
"""

import os
import sys
from collections import defaultdict
from statistics import mode, StatisticsError

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.supabase_client import get_supabase_client


def get_most_common_value(values: list):
    """Get the most common non-None value from a list."""
    filtered = [v for v in values if v is not None]
    if not filtered:
        return None
    try:
        return mode(filtered)
    except StatisticsError:
        # If no mode (all values unique), return the first one
        return filtered[0]


def backfill_metric_definitions(dry_run: bool = False) -> dict:
    """
    Backfill metric_definitions from existing metrics data.

    Args:
        dry_run: If True, print what would be done without making changes.

    Returns:
        Stats dictionary with counts.
    """
    client = get_supabase_client()

    # Get all profiles
    profiles_result = client.table("profiles").select("id, display_name").execute()
    profiles = profiles_result.data

    total_definitions = 0
    total_profiles = 0

    for profile in profiles:
        profile_id = profile["id"]
        profile_name = profile["display_name"]
        print(f"\n📋 Processing profile: {profile_name}")

        # Get all reports for this profile
        reports_result = client.table("reports").select("id").eq("profile_id", profile_id).execute()
        report_ids = [r["id"] for r in reports_result.data]

        if not report_ids:
            print(f"   No reports found, skipping.")
            continue

        # Get all metrics for this profile's reports
        metrics_result = client.table("metrics").select(
            "name, unit, ref_low, ref_high"
        ).in_("report_id", report_ids).execute()

        if not metrics_result.data:
            print(f"   No metrics found, skipping.")
            continue

        # Group by metric name
        metrics_by_name = defaultdict(lambda: {"units": [], "ref_lows": [], "ref_highs": []})
        for m in metrics_result.data:
            name = m["name"]
            metrics_by_name[name]["units"].append(m["unit"])
            metrics_by_name[name]["ref_lows"].append(m["ref_low"])
            metrics_by_name[name]["ref_highs"].append(m["ref_high"])

        # Build definitions to upsert
        definitions = []
        for name, data in metrics_by_name.items():
            definition = {
                "profile_id": profile_id,
                "name": name,
                "unit": get_most_common_value(data["units"]),
                "ref_low": get_most_common_value(data["ref_lows"]),
                "ref_high": get_most_common_value(data["ref_highs"]),
                "display_order": 0,  # Default order
                "is_favorite": False,
            }
            definitions.append(definition)

        print(f"   Found {len(definitions)} unique metrics")

        if dry_run:
            print(f"   [DRY RUN] Would upsert {len(definitions)} definitions")
            for d in definitions[:5]:  # Show first 5
                print(f"      - {d['name']}: {d['unit']} ({d['ref_low']} - {d['ref_high']})")
            if len(definitions) > 5:
                print(f"      ... and {len(definitions) - 5} more")
        else:
            # Upsert in batches of 50
            batch_size = 50
            for i in range(0, len(definitions), batch_size):
                batch = definitions[i:i + batch_size]
                client.table("metric_definitions").upsert(
                    batch,
                    on_conflict="profile_id,name"
                ).execute()
            print(f"   ✅ Upserted {len(definitions)} metric definitions")

        total_definitions += len(definitions)
        total_profiles += 1

    return {
        "profiles_processed": total_profiles,
        "definitions_upserted": total_definitions,
    }


def verify_backfill() -> bool:
    """
    Verify that metric_definitions count matches distinct metrics count.

    Returns:
        True if counts match, False otherwise.
    """
    client = get_supabase_client()

    # Get all profiles
    profiles_result = client.table("profiles").select("id, display_name").execute()
    profiles = profiles_result.data

    all_match = True

    print("\n📊 Verification:")
    for profile in profiles:
        profile_id = profile["id"]
        profile_name = profile["display_name"]

        # Count distinct metrics
        reports_result = client.table("reports").select("id").eq("profile_id", profile_id).execute()
        report_ids = [r["id"] for r in reports_result.data]

        if not report_ids:
            continue

        metrics_result = client.table("metrics").select("name").in_("report_id", report_ids).execute()
        distinct_metrics = len(set(m["name"] for m in metrics_result.data))

        # Count definitions
        definitions_result = client.table("metric_definitions").select("id").eq("profile_id", profile_id).execute()
        definition_count = len(definitions_result.data)

        match = "✅" if distinct_metrics == definition_count else "❌"
        print(f"   {match} {profile_name}: {distinct_metrics} distinct metrics, {definition_count} definitions")

        if distinct_metrics != definition_count:
            all_match = False

    return all_match


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Backfill metric_definitions from existing metrics")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without making changes")
    args = parser.parse_args()

    print("=" * 60)
    print("Backfill Metric Definitions")
    print("=" * 60)

    if args.dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made\n")

    stats = backfill_metric_definitions(dry_run=args.dry_run)

    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  Profiles processed: {stats['profiles_processed']}")
    print(f"  Definitions {'would be ' if args.dry_run else ''}upserted: {stats['definitions_upserted']}")
    print("=" * 60)

    if not args.dry_run:
        print("\nVerifying backfill...")
        if verify_backfill():
            print("\n✅ Backfill verified successfully!")
            return 0
        else:
            print("\n❌ Backfill verification failed - counts don't match!")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
