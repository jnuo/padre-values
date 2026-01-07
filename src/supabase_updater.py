"""
Supabase updater module.
Provides functions to save and retrieve blood test data from Supabase.
"""

import logging
from datetime import datetime
from typing import Optional

from src.supabase_client import get_supabase_client
from src.value_validator import (
    validate_metric_value,
    validate_reference_change,
    get_existing_values_for_metric,
    get_existing_reference,
)

# Configure logging
logger = logging.getLogger(__name__)


# Default profile name used for automated imports
DEFAULT_PROFILE_NAME = "Yüksel O."


def get_or_create_profile(profile_name: str = DEFAULT_PROFILE_NAME) -> str:
    """
    Get or create a profile by name.

    Args:
        profile_name: Display name for the profile.

    Returns:
        The profile UUID.
    """
    client = get_supabase_client()

    # Check if profile exists
    result = client.table("profiles").select("id").eq("display_name", profile_name).execute()

    if result.data:
        return result.data[0]["id"]

    # Create new profile
    result = client.table("profiles").insert({
        "display_name": profile_name,
        "owner_user_id": None
    }).execute()

    return result.data[0]["id"]


def save_report(
    profile_id: str,
    sample_date: str,
    tests_dict: dict,
    file_name: Optional[str] = None,
    validate: bool = True
) -> tuple[str, dict]:
    """
    Save a blood test report to Supabase.

    This function:
    1. Creates or finds the report
    2. Validates each metric value against historical data (if validate=True)
    3. Inserts valid metrics
    4. Upserts metric_definitions with reference values

    Args:
        profile_id: UUID of the profile this report belongs to.
        sample_date: Date of the blood test (YYYY-MM-DD format).
        tests_dict: Dictionary of test results, e.g.:
            {
                "Hemoglobin": {"value": 14.2, "unit": "g/dL", "ref_low": 12.0, "ref_high": 16.0, "flag": "N"},
                "WBC": {"value": 7500, "unit": "/µL", "ref_low": 4000, "ref_high": 11000}
            }
        file_name: Optional source PDF filename.
        validate: Whether to validate values against historical data (default: True).
            Set to False for migration/backfill operations.

    Returns:
        Tuple of (report_id, stats) where stats contains:
        - inserted: number of metrics inserted
        - skipped: number of metrics skipped due to validation
        - warnings: list of warning messages

    Raises:
        Exception: If the insert fails.
    """
    client = get_supabase_client()
    stats = {"inserted": 0, "skipped": 0, "warnings": []}

    # Create or get the report
    result = client.table("reports").select("id").eq("profile_id", profile_id).eq("sample_date", sample_date).execute()

    if result.data:
        report_id = result.data[0]["id"]
    else:
        result = client.table("reports").insert({
            "profile_id": profile_id,
            "sample_date": sample_date,
            "file_name": file_name,
            "source": "pdf"
        }).execute()
        report_id = result.data[0]["id"]

    # Validate and insert metrics
    metrics_to_upsert = []
    definitions_to_upsert = []

    for name, data in tests_dict.items():
        value = data.get("value")
        if value is None:
            continue

        try:
            value = float(value)
        except (TypeError, ValueError):
            logger.warning(f"⚠️  Skipping {name}: value '{value}' is not numeric")
            stats["skipped"] += 1
            stats["warnings"].append(f"{name}: non-numeric value '{value}'")
            continue

        # Validate value against historical data (if enabled)
        if validate:
            existing_values = get_existing_values_for_metric(profile_id, name)
            validation = validate_metric_value(name, value, existing_values)

            if not validation.valid:
                logger.warning(f"⚠️  Skipping {name}: {validation.reason}")
                stats["skipped"] += 1
                stats["warnings"].append(f"{name}: {validation.reason}")
                continue

        # Value is valid - add to upsert list
        metrics_to_upsert.append({
            "report_id": report_id,
            "name": name,
            "value": value,
            "unit": data.get("unit"),
            "ref_low": data.get("ref_low"),
            "ref_high": data.get("ref_high"),
            "flag": data.get("flag"),
        })

        # Prepare metric_definition upsert
        new_ref_low = data.get("ref_low")
        new_ref_high = data.get("ref_high")

        # Get existing reference values
        existing_ref_low, existing_ref_high = get_existing_reference(profile_id, name)

        # Validate reference changes
        ref_low_result = validate_reference_change(existing_ref_low, new_ref_low, "ref_low")
        ref_high_result = validate_reference_change(existing_ref_high, new_ref_high, "ref_high")

        # Collect warnings
        if ref_low_result.warning:
            stats["warnings"].append(f"{name}: {ref_low_result.warning}")
        if ref_high_result.warning:
            stats["warnings"].append(f"{name}: {ref_high_result.warning}")

        # Build the definition update
        definition = {
            "profile_id": profile_id,
            "name": name,
            "unit": data.get("unit"),
        }

        # Only include refs that should be updated
        if ref_low_result.should_update and new_ref_low is not None:
            definition["ref_low"] = new_ref_low
        if ref_high_result.should_update and new_ref_high is not None:
            definition["ref_high"] = new_ref_high

        definitions_to_upsert.append(definition)

    # Upsert metrics
    if metrics_to_upsert:
        client.table("metrics").upsert(
            metrics_to_upsert,
            on_conflict="report_id,name"
        ).execute()
        stats["inserted"] = len(metrics_to_upsert)

    # Upsert metric_definitions
    if definitions_to_upsert:
        client.table("metric_definitions").upsert(
            definitions_to_upsert,
            on_conflict="profile_id,name"
        ).execute()

    return report_id, stats


def save_extracted_values(values_dict: dict, file_name: Optional[str] = None) -> Optional[str]:
    """
    Save extracted lab values to Supabase.

    This is the main entry point called from main.py, matching the interface
    expected by the existing workflow.

    Args:
        values_dict: Dictionary from pdf_reader.extract_labs_from_pdf(), e.g.:
            {
                "sample_date": "2024-01-15",
                "tests": {
                    "Hemoglobin": {"value": 14.2, "unit": "g/dL", ...}
                }
            }
        file_name: Optional source PDF filename.

    Returns:
        The report UUID if successful, None if no data to save.
    """
    sample_date = values_dict.get("sample_date")
    tests = values_dict.get("tests", {})

    if not sample_date or not tests:
        print("Nothing to save (missing sample_date or tests).")
        return None

    # Get or create the default profile
    profile_id = get_or_create_profile()

    # Save the report and metrics (with validation enabled)
    report_id, stats = save_report(profile_id, sample_date, tests, file_name, validate=True)

    # Print summary
    print(f"Saved report {report_id} for {sample_date}:")
    print(f"  ✅ Inserted: {stats['inserted']} metrics")
    if stats['skipped'] > 0:
        print(f"  ⚠️  Skipped: {stats['skipped']} metrics (see warnings above)")
    if stats['warnings']:
        for warning in stats['warnings']:
            print(f"  ⚠️  {warning}")

    return report_id


def batch_save_extracted_values(updates: list, file_names: Optional[list] = None) -> list:
    """
    Save multiple extracted lab values to Supabase.

    Args:
        updates: List of dictionaries from pdf_reader.extract_labs_from_pdf().
        file_names: Optional list of source PDF filenames.

    Returns:
        List of report UUIDs.
    """
    report_ids = []

    for i, values_dict in enumerate(updates):
        file_name = file_names[i] if file_names and i < len(file_names) else None
        report_id = save_extracted_values(values_dict, file_name)
        if report_id:
            report_ids.append(report_id)

    return report_ids


def get_profile_metrics(profile_id: str) -> list:
    """
    Get all metrics for a profile, organized by date.

    Args:
        profile_id: UUID of the profile.

    Returns:
        List of dictionaries with report and metrics data:
        [
            {
                "sample_date": "2024-01-15",
                "metrics": {
                    "Hemoglobin": {"value": 14.2, "unit": "g/dL", "ref_low": 12.0, "ref_high": 16.0},
                    ...
                }
            },
            ...
        ]
    """
    client = get_supabase_client()

    # Get all reports for this profile
    reports_result = client.table("reports").select(
        "id, sample_date"
    ).eq("profile_id", profile_id).order("sample_date", desc=True).execute()

    results = []
    for report in reports_result.data:
        # Get metrics for this report
        metrics_result = client.table("metrics").select(
            "name, value, unit, ref_low, ref_high, flag"
        ).eq("report_id", report["id"]).execute()

        metrics_dict = {}
        for m in metrics_result.data:
            metrics_dict[m["name"]] = {
                "value": m["value"],
                "unit": m["unit"],
                "ref_low": m["ref_low"],
                "ref_high": m["ref_high"],
                "flag": m["flag"],
            }

        results.append({
            "sample_date": report["sample_date"],
            "metrics": metrics_dict
        })

    return results


def get_all_metrics_for_dashboard(profile_name: str = DEFAULT_PROFILE_NAME) -> dict:
    """
    Get all metrics for a profile in a format suitable for the dashboard.

    Returns data in the same format as the Google Sheets API endpoint.
    Reference values come from metric_definitions (canonical) rather than
    individual metric rows (which may vary by lab).

    Args:
        profile_name: Display name of the profile.

    Returns:
        Dictionary with dates as keys and metric values, plus reference values:
        {
            "dates": ["2024-01-15", "2024-02-20", ...],
            "metrics": {
                "Hemoglobin": {
                    "values": [14.2, 14.5, ...],
                    "unit": "g/dL",
                    "ref_low": 12.0,
                    "ref_high": 16.0
                },
                ...
            }
        }
    """
    client = get_supabase_client()

    # Find the profile
    profile_result = client.table("profiles").select("id").eq("display_name", profile_name).execute()
    if not profile_result.data:
        return {"dates": [], "metrics": {}}

    profile_id = profile_result.data[0]["id"]

    # Get all reports ordered by date
    reports_result = client.table("reports").select(
        "id, sample_date"
    ).eq("profile_id", profile_id).order("sample_date").execute()

    if not reports_result.data:
        return {"dates": [], "metrics": {}}

    # Build the result structure
    dates = [r["sample_date"] for r in reports_result.data]
    report_ids = [r["id"] for r in reports_result.data]

    # Get canonical reference values from metric_definitions
    definitions_result = client.table("metric_definitions").select(
        "name, unit, ref_low, ref_high, display_order"
    ).eq("profile_id", profile_id).order("display_order").execute()

    # Build lookup for definitions
    definitions_by_name = {}
    for d in definitions_result.data:
        definitions_by_name[d["name"]] = {
            "unit": d["unit"],
            "ref_low": d["ref_low"],
            "ref_high": d["ref_high"],
            "display_order": d["display_order"],
        }

    # Get all metrics for all reports (values only, refs from definitions)
    metrics_result = client.table("metrics").select(
        "report_id, name, value, unit, ref_low, ref_high"
    ).in_("report_id", report_ids).execute()

    # Organize metrics by name
    metrics_by_name = {}
    for m in metrics_result.data:
        name = m["name"]
        if name not in metrics_by_name:
            # Use metric_definitions if available, fallback to metric row
            definition = definitions_by_name.get(name, {})
            metrics_by_name[name] = {
                "values_by_report": {},
                "unit": definition.get("unit") or m["unit"],
                "ref_low": definition.get("ref_low") if definition.get("ref_low") is not None else m["ref_low"],
                "ref_high": definition.get("ref_high") if definition.get("ref_high") is not None else m["ref_high"],
                "display_order": definition.get("display_order", 0),
            }
        metrics_by_name[name]["values_by_report"][m["report_id"]] = m["value"]

    # Sort metrics by display_order, then by name
    sorted_names = sorted(
        metrics_by_name.keys(),
        key=lambda n: (metrics_by_name[n]["display_order"], n)
    )

    # Convert to ordered arrays
    result_metrics = {}
    for name in sorted_names:
        data = metrics_by_name[name]
        values = []
        for report_id in report_ids:
            value = data["values_by_report"].get(report_id)
            values.append(value)

        result_metrics[name] = {
            "values": values,
            "unit": data["unit"],
            "ref_low": data["ref_low"],
            "ref_high": data["ref_high"],
        }

    return {
        "dates": dates,
        "metrics": result_metrics
    }
