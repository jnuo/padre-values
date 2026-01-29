#!/usr/bin/env python3
"""
Backfill content_hash for existing reports.

This script:
1. Reads all PDF files in the downloads/ folder
2. Calculates their MD5 hash
3. Extracts date from filename (YYYY-MM-DD prefix)
4. Matches them to existing reports by sample_date
5. Updates the content_hash in the database

Run this ONCE after applying the migration to prevent
re-processing of already-imported PDFs.

Usage:
    python scripts/backfill_content_hashes.py
"""

import os
import re
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.file_utils import get_file_hash
from src.supabase_client import get_supabase_client


def extract_date_from_filename(filename: str) -> str | None:
    """Extract YYYY-MM-DD date from filename."""
    # Match patterns like 2025-06-23, 2025-06-23_xxx, 2025-06-23-xxx
    match = re.match(r'^(\d{4}-\d{2}-\d{2})', filename)
    if match:
        return match.group(1)
    return None


def backfill_content_hashes(downloads_dir: str = "downloads"):
    """
    Backfill content_hash for existing reports based on files in downloads/.
    """
    client = get_supabase_client()

    # Get all PDF files in downloads folder
    if not os.path.exists(downloads_dir):
        print(f"Downloads folder not found: {downloads_dir}")
        return

    pdf_files = [f for f in os.listdir(downloads_dir) if f.lower().endswith('.pdf')]
    print(f"Found {len(pdf_files)} PDF files in {downloads_dir}/")

    if not pdf_files:
        print("No PDF files to process.")
        return

    # Group files by date (multiple files can have same date)
    files_by_date: dict[str, list[tuple[str, str]]] = {}  # date -> [(filename, hash), ...]

    for file_name in pdf_files:
        file_path = os.path.join(downloads_dir, file_name)
        sample_date = extract_date_from_filename(file_name)

        if not sample_date:
            print(f"  ⚠️  Cannot extract date from: {file_name}")
            continue

        content_hash = get_file_hash(file_path)

        if sample_date not in files_by_date:
            files_by_date[sample_date] = []
        files_by_date[sample_date].append((file_name, content_hash))

    print(f"Found {len(files_by_date)} unique dates")

    updated_count = 0
    skipped_count = 0
    not_found_count = 0

    for sample_date, files in sorted(files_by_date.items()):
        # Find report by sample_date
        result = client.table("reports").select("id, content_hash, file_name").eq("sample_date", sample_date).execute()

        if not result.data:
            print(f"  ⚠️  No report found for date: {sample_date}")
            not_found_count += 1
            continue

        report = result.data[0]

        if report.get("content_hash"):
            print(f"  ⏭️  Already has hash: {sample_date}")
            skipped_count += 1
            continue

        # Use the first file's hash (if multiple files for same date)
        file_name, content_hash = files[0]

        # Update the report with content_hash and file_name
        client.table("reports").update({
            "content_hash": content_hash,
            "file_name": file_name
        }).eq("id", report["id"]).execute()

        print(f"  ✅ Updated: {sample_date} ({file_name}) → {content_hash[:12]}...")
        updated_count += 1

    print(f"\n--- Summary ---")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped (already had hash): {skipped_count}")
    print(f"  Not found in DB: {not_found_count}")


if __name__ == "__main__":
    print("Backfilling content hashes for existing reports...")
    print("=" * 50)
    backfill_content_hashes()
    print("\nDone!")
