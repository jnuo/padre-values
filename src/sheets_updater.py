import gspread
import pandas as pd
from datetime import datetime
import os
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from src.config import GOOGLE_CREDENTIALS_FILE, SHEET_ID, SHEET_NAME, LOOKER_SHEET_NAME


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
            creds.refresh(Request())
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
    """
    gc = get_sheets_client()
    sh = gc.open_by_key(SHEET_ID)
    ws = sh.worksheet(SHEET_NAME)
    data = ws.get_all_values()
    if not data:
        data = [["metric"]]
    width = max(len(r) for r in data)
    data = [r + [""] * (width - len(r)) for r in data]
    return data

def batch_update_sheet(sheet_data, updates):
    """
    Applies a list of values_dicts (from extract_labs_from_pdf) to the in-memory sheet_data, then writes back once.
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
