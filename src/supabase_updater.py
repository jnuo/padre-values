"""
Supabase updater module.
Provides functions to save and retrieve blood test data from Supabase.
"""

from datetime import datetime
from typing import Optional

from src.supabase_client import get_supabase_client


# Default profile name used for automated imports
DEFAULT_PROFILE_NAME = "Father (Migrated)"


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


def save_report(profile_id: str, sample_date: str, tests_dict: dict, file_name: Optional[str] = None) -> str:
    """
    Save a blood test report to Supabase.

    Args:
        profile_id: UUID of the profile this report belongs to.
        sample_date: Date of the blood test (YYYY-MM-DD format).
        tests_dict: Dictionary of test results, e.g.:
            {
                "Hemoglobin": {"value": 14.2, "unit": "g/dL", "ref_low": 12.0, "ref_high": 16.0, "flag": "N"},
                "WBC": {"value": 7500, "unit": "/µL", "ref_low": 4000, "ref_high": 11000}
            }
        file_name: Optional source PDF filename.

    Returns:
        The report UUID.

    Raises:
        Exception: If the insert fails.
    """
    client = get_supabase_client()

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

    # Insert or update metrics
    metrics_to_upsert = []
    for name, data in tests_dict.items():
        value = data.get("value")
        if value is None:
            continue

        metrics_to_upsert.append({
            "report_id": report_id,
            "name": name,
            "value": float(value),
            "unit": data.get("unit"),
            "ref_low": data.get("ref_low"),
            "ref_high": data.get("ref_high"),
            "flag": data.get("flag"),
        })

    if metrics_to_upsert:
        client.table("metrics").upsert(
            metrics_to_upsert,
            on_conflict="report_id,name"
        ).execute()

    return report_id


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

    # Save the report and metrics
    report_id = save_report(profile_id, sample_date, tests, file_name)
    print(f"Saved report {report_id} with {len(tests)} metrics for {sample_date}")

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

    # Get all metrics for all reports
    metrics_result = client.table("metrics").select(
        "report_id, name, value, unit, ref_low, ref_high"
    ).in_("report_id", report_ids).execute()

    # Organize metrics by name
    metrics_by_name = {}
    for m in metrics_result.data:
        name = m["name"]
        if name not in metrics_by_name:
            metrics_by_name[name] = {
                "values_by_report": {},
                "unit": m["unit"],
                "ref_low": m["ref_low"],
                "ref_high": m["ref_high"],
            }
        metrics_by_name[name]["values_by_report"][m["report_id"]] = m["value"]

    # Convert to ordered arrays
    result_metrics = {}
    for name, data in metrics_by_name.items():
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
