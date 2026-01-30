# src/drive_monitor.py
import os
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from src.config import GOOGLE_CREDENTIALS_FILE, DRIVE_FOLDER_ID

# SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"]  # listing only
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

def get_drive_service():
    creds = None
    token_path = "token_drive.json"
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(GOOGLE_CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w") as f:
            f.write(creds.to_json())
    return build("drive", "v3", credentials=creds)

def list_pdf_files():
    return list_files_in_folder(DRIVE_FOLDER_ID, "application/pdf")

def list_files_in_folder(folder_id, mime=None):
    service = get_drive_service()
    parts = [f"'{folder_id}' in parents", "trashed = false"]
    if mime:
        parts.append(f"mimeType = '{mime}'")
    query = " and ".join(parts)

    files, page_token = [], None
    while True:
        resp = service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)",
            pageSize=1000,
            orderBy="modifiedTime desc",
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            pageToken=page_token,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


from googleapiclient.http import MediaIoBaseDownload
import io

def download_file(file_id, file_name, download_dir="downloads"):
    """
    Download a file from Google Drive to the local filesystem.
    Returns the local file path.
    """
    service = get_drive_service()
    os.makedirs(download_dir, exist_ok=True)

    local_path = os.path.join(download_dir, file_name)
    if os.path.exists(local_path):
        print(f"  📁 Local cache: {file_name}")
        return local_path

    print(f"  ⬇️  Downloading: {file_name}")
    request = service.files().get_media(fileId=file_id)
    os.makedirs(download_dir, exist_ok=True)
    local_path = os.path.join(download_dir, file_name)
    with open(local_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
            progress = int(status.progress() * 100)
            if progress < 100:
                print(f"     → {progress}%", end="\r")
    print(f"  ✅ Downloaded: {file_name}")
    return local_path
