"""
Value validation module.

Provides functions to validate metric values and reference range changes
to prevent bad data from being inserted into the database.

AI extraction from PDFs sometimes produces garbage (wrong decimal place,
misread values, unit confusion). This module catches suspicious values
before they corrupt the charts.
"""

import logging
from dataclasses import dataclass
from statistics import median
from typing import Optional

# Configure logging to show warnings to the user
logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of a value validation check."""
    valid: bool
    reason: str


@dataclass
class ReferenceUpdateResult:
    """Result of a reference range change check."""
    should_update: bool
    warning: Optional[str]


def calculate_median(values: list[float]) -> float:
    """Calculate median of a list of values, filtering out None."""
    filtered = [v for v in values if v is not None]
    if not filtered:
        return 0.0
    return median(filtered)


def validate_metric_value(
    name: str,
    value: float,
    existing_values: list[float],
    max_deviation_pct: float = 500.0
) -> ValidationResult:
    """
    Validate that a new metric value is reasonable based on historical values.

    This catches common AI extraction errors like:
    - Wrong decimal place (14.2 vs 142 vs 1.42)
    - Unit confusion (g/dL vs mg/dL)
    - OCR errors reading digits

    Args:
        name: Name of the metric (for logging context).
        value: The new value to validate.
        existing_values: List of previous values for this metric.
        max_deviation_pct: Maximum allowed deviation from median (default 500%).

    Returns:
        ValidationResult with valid=True if acceptable, valid=False if suspicious.

    Examples:
        >>> validate_metric_value("Hemoglobin", 14.2, [13.5, 14.0, 13.8])
        ValidationResult(valid=True, reason="Value within normal range of historical values")

        >>> validate_metric_value("Hemoglobin", 142, [13.5, 14.0, 13.8])
        ValidationResult(valid=False, reason="Value 142 is 921.7% different from median 13.9...")
    """
    # Rule 1: Value must be numeric (caller should ensure this, but check anyway)
    if value is None:
        return ValidationResult(
            valid=False,
            reason="Value is None"
        )

    try:
        value = float(value)
    except (TypeError, ValueError):
        return ValidationResult(
            valid=False,
            reason=f"Value '{value}' is not numeric"
        )

    # Rule 2: First value for this metric - accept it
    filtered_existing = [v for v in existing_values if v is not None]
    if not filtered_existing:
        return ValidationResult(
            valid=True,
            reason="First value for this metric, accepted"
        )

    # Rule 3: Check deviation from median
    med = calculate_median(filtered_existing)

    # Avoid division by zero - if median is 0, use absolute comparison
    if med == 0:
        if abs(value) > 1000:  # Arbitrary threshold for zero-centered metrics
            return ValidationResult(
                valid=False,
                reason=f"Value {value} is very far from median 0"
            )
        return ValidationResult(
            valid=True,
            reason="Value acceptable (median is 0)"
        )

    deviation_pct = abs(value - med) / abs(med) * 100

    if deviation_pct > max_deviation_pct:
        warning_msg = (
            f"Suspicious value for {name}: {value} is {deviation_pct:.1f}% "
            f"different from median {med:.2f} (threshold: {max_deviation_pct}%)"
        )
        logger.warning(f"⚠️  {warning_msg}")
        return ValidationResult(
            valid=False,
            reason=warning_msg
        )

    return ValidationResult(
        valid=True,
        reason="Value within normal range of historical values"
    )


def validate_reference_change(
    existing_ref: Optional[float],
    new_ref: Optional[float],
    ref_type: str = "reference"
) -> ReferenceUpdateResult:
    """
    Validate whether a reference range value should be updated.

    Different labs may report slightly different reference ranges. This function
    allows minor variations while rejecting suspicious changes that might indicate
    data quality issues.

    Rules:
    - No existing ref: accept new ref
    - No new ref: keep existing (don't overwrite with None)
    - ≤15% difference: accept silently (minor lab variation)
    - 15-50% difference: accept with warning (moderate change)
    - >50% difference: reject (suspicious change)

    Args:
        existing_ref: Current reference value in database (can be None).
        new_ref: New reference value from PDF extraction (can be None).
        ref_type: Type of reference for logging ("ref_low" or "ref_high").

    Returns:
        ReferenceUpdateResult with should_update and optional warning.

    Examples:
        >>> validate_reference_change(None, 12.0)
        ReferenceUpdateResult(should_update=True, warning=None)

        >>> validate_reference_change(12.0, None)
        ReferenceUpdateResult(should_update=False, warning=None)

        >>> validate_reference_change(12.0, 12.5)  # 4.2% diff
        ReferenceUpdateResult(should_update=True, warning=None)

        >>> validate_reference_change(12.0, 15.0)  # 25% diff
        ReferenceUpdateResult(should_update=True, warning="Reference changed 12.0 → 15.0 (25.0%)")

        >>> validate_reference_change(12.0, 24.0)  # 100% diff
        ReferenceUpdateResult(should_update=False, warning="Suspicious ref change...")
    """
    # No existing reference - accept new value
    if existing_ref is None:
        return ReferenceUpdateResult(
            should_update=True,
            warning=None
        )

    # No new reference - keep existing (don't overwrite with None)
    if new_ref is None:
        return ReferenceUpdateResult(
            should_update=False,
            warning=None
        )

    # Both values present - calculate difference percentage
    try:
        existing_ref = float(existing_ref)
        new_ref = float(new_ref)
    except (TypeError, ValueError):
        return ReferenceUpdateResult(
            should_update=False,
            warning=f"Invalid reference values: existing={existing_ref}, new={new_ref}"
        )

    # Avoid division by zero
    if existing_ref == 0:
        if new_ref == 0:
            return ReferenceUpdateResult(should_update=False, warning=None)
        # If existing is 0 and new is not, that's suspicious
        warning = f"Suspicious {ref_type} change: 0 → {new_ref}"
        logger.warning(f"⚠️  {warning}")
        return ReferenceUpdateResult(should_update=False, warning=warning)

    diff_pct = abs(new_ref - existing_ref) / abs(existing_ref) * 100

    # ≤15%: Accept silently (minor lab variation)
    if diff_pct <= 15:
        return ReferenceUpdateResult(
            should_update=True,
            warning=None
        )

    # 15-50%: Accept with warning (moderate change)
    if diff_pct <= 50:
        warning = f"Reference {ref_type} changed {existing_ref} → {new_ref} ({diff_pct:.1f}%)"
        logger.warning(f"⚠️  {warning}")
        return ReferenceUpdateResult(
            should_update=True,
            warning=warning
        )

    # >50%: Reject (suspicious change)
    warning = (
        f"Suspicious {ref_type} change rejected: {existing_ref} → {new_ref} "
        f"({diff_pct:.1f}% difference, threshold: 50%)"
    )
    logger.error(f"❌  {warning}")
    return ReferenceUpdateResult(
        should_update=False,
        warning=warning
    )


def get_existing_values_for_metric(
    profile_id: str,
    metric_name: str
) -> list[float]:
    """
    Fetch existing values for a metric from Supabase.

    Args:
        profile_id: UUID of the profile.
        metric_name: Name of the metric.

    Returns:
        List of historical values for this metric.
    """
    from src.supabase_client import get_supabase_client

    client = get_supabase_client()

    # Get all reports for this profile
    reports_result = client.table("reports").select("id").eq("profile_id", profile_id).execute()

    if not reports_result.data:
        return []

    report_ids = [r["id"] for r in reports_result.data]

    # Get all values for this metric across all reports
    metrics_result = client.table("metrics").select("value").eq("name", metric_name).in_("report_id", report_ids).execute()

    return [m["value"] for m in metrics_result.data if m["value"] is not None]


def get_existing_reference(
    profile_id: str,
    metric_name: str
) -> tuple[Optional[float], Optional[float]]:
    """
    Fetch existing reference values for a metric from metric_definitions.

    Args:
        profile_id: UUID of the profile.
        metric_name: Name of the metric.

    Returns:
        Tuple of (ref_low, ref_high), either or both can be None.
    """
    from src.supabase_client import get_supabase_client

    client = get_supabase_client()

    result = client.table("metric_definitions").select(
        "ref_low, ref_high"
    ).eq("profile_id", profile_id).eq("name", metric_name).execute()

    if not result.data:
        return (None, None)

    row = result.data[0]
    return (row.get("ref_low"), row.get("ref_high"))
