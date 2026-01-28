"""
JSON Comparison Utility

Compares API responses and database snapshots for migration verification.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional
from deepdiff import DeepDiff


def load_json(file_path: Path) -> Dict[str, Any]:
    """Load JSON from file."""
    with open(file_path, "r") as f:
        return json.load(f)


def compare_json(
    baseline: Dict[str, Any],
    current: Dict[str, Any],
    ignore_keys: Optional[List[str]] = None
) -> Tuple[bool, Optional[Dict]]:
    """
    Compare two JSON structures.

    Args:
        baseline: The baseline/expected JSON
        current: The current JSON to compare
        ignore_keys: Keys to ignore in comparison (e.g., timestamps)

    Returns:
        Tuple of (is_equal, differences_dict)
    """
    exclude_paths = set()
    if ignore_keys:
        for key in ignore_keys:
            exclude_paths.add(f"root['{key}']")

    diff = DeepDiff(
        baseline,
        current,
        exclude_paths=exclude_paths,
        ignore_order=False
    )

    if not diff:
        return True, None

    return False, dict(diff)


def compare_response_bodies(
    baseline_file: Path,
    current_file: Path,
    ignore_timestamps: bool = True
) -> Tuple[bool, Optional[Dict]]:
    """
    Compare API response bodies from captured files.

    Args:
        baseline_file: Path to baseline JSON file
        current_file: Path to current JSON file
        ignore_timestamps: Whether to ignore timestamp fields

    Returns:
        Tuple of (is_equal, differences_dict)
    """
    baseline = load_json(baseline_file)
    current = load_json(current_file)

    # Extract just the body if it's a full capture
    baseline_body = baseline.get("body", baseline)
    current_body = current.get("body", current)

    ignore_keys = []
    if ignore_timestamps:
        ignore_keys.extend(["captured_at", "created_at", "updated_at"])

    return compare_json(baseline_body, current_body, ignore_keys)


def compare_status_codes(baseline_file: Path, current_file: Path) -> bool:
    """Compare HTTP status codes from captured responses."""
    baseline = load_json(baseline_file)
    current = load_json(current_file)

    baseline_status = baseline.get("status_code") or baseline.get("status")
    current_status = current.get("status_code") or current.get("status")

    return baseline_status == current_status


def compare_row_counts(
    baseline_counts: Dict[str, int],
    current_counts: Dict[str, int]
) -> Tuple[bool, List[str]]:
    """
    Compare database row counts.

    Returns:
        Tuple of (all_match, list_of_mismatches)
    """
    mismatches = []

    all_tables = set(baseline_counts.keys()) | set(current_counts.keys())

    for table in all_tables:
        baseline_count = baseline_counts.get(table, 0)
        current_count = current_counts.get(table, 0)

        if baseline_count != current_count:
            mismatches.append(
                f"{table}: expected {baseline_count}, got {current_count}"
            )

    return len(mismatches) == 0, mismatches


def compare_checksums(baseline_file: Path, current_file: Path) -> bool:
    """Compare MD5 checksums from files."""
    with open(baseline_file, "r") as f:
        baseline = f.read().strip()

    with open(current_file, "r") as f:
        current = f.read().strip()

    return baseline == current
