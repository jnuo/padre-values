# Blood Test PDF to Google Sheets Sync

This Python project monitors a Google Drive folder for new PDF files, extracts blood test values using the OpenAI API, and updates a Google Sheet with the results.

## Features

- Monitors a Google Drive folder for new PDFs
- Extracts blood test values (e.g., hemoglobin, trombosit) from PDFs using OpenAI API
- Updates or appends rows in a Google Sheet

## Setup

- Python 3.9+
- Google Drive API credentials
- Google Sheets API credentials
- OpenAI API key

## Structure

- `src/` — Main source code
- `src/drive_monitor.py` — Google Drive monitoring logic
- `src/pdf_reader.py` — PDF reading and value extraction
- `src/sheets_updater.py` — Google Sheets update logic
- `src/config.py` — Configuration and credentials

## Usage

1. Configure API keys and credentials in `src/config.py`.
2. Run the main script to start monitoring and updating.

## Next Steps

- Add web app for charting values
- Add database integration
