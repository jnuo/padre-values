"""
API Response Capture Utility

Captures HTTP responses with metadata for baseline comparison.
"""

import json
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any


def capture_response(
    url: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    output_file: Optional[Path] = None
) -> Dict[str, Any]:
    """
    Capture an HTTP response with full metadata.

    Returns:
        Dict containing:
        - status_code: int
        - headers: dict
        - body: parsed JSON or raw text
        - captured_at: ISO timestamp
        - request: original request details
    """
    default_headers = {"Content-Type": "application/json"}
    if headers:
        default_headers.update(headers)

    if method.upper() == "GET":
        response = requests.get(url, headers=default_headers)
    elif method.upper() == "PUT":
        response = requests.put(url, json=data, headers=default_headers)
    elif method.upper() == "POST":
        response = requests.post(url, json=data, headers=default_headers)
    elif method.upper() == "DELETE":
        response = requests.delete(url, headers=default_headers)
    else:
        raise ValueError(f"Unsupported method: {method}")

    try:
        body = response.json()
    except json.JSONDecodeError:
        body = response.text

    result = {
        "status_code": response.status_code,
        "headers": dict(response.headers),
        "body": body,
        "captured_at": datetime.utcnow().isoformat(),
        "request": {
            "url": url,
            "method": method,
            "data": data
        }
    }

    if output_file:
        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

    return result


def capture_metrics(base_url: str, profile_name: Optional[str] = None) -> Dict[str, Any]:
    """Capture /api/metrics endpoint response."""
    url = f"{base_url}/api/metrics"
    if profile_name:
        url += f"?profileName={profile_name}"
    return capture_response(url)


def capture_metric_order(base_url: str, profile_name: Optional[str] = None) -> Dict[str, Any]:
    """Capture /api/metric-order GET endpoint response."""
    url = f"{base_url}/api/metric-order"
    if profile_name:
        url += f"?profileName={profile_name}"
    return capture_response(url)
