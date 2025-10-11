"""
Main script to monitor Google Drive for new PDFs, extract blood test values using OpenAI, and update Google Sheets.

Debugging guidelines are included below.
"""
from src import drive_monitor, pdf_reader, sheets_updater

def main():
   # 1. List PDF files in the Drive folder
   print("Listing PDF files in Google Drive folder...")
   pdf_files = drive_monitor.list_pdf_files()
   print(f"Found {len(pdf_files)} PDF files.")
   if not pdf_files:
      print("No PDF files found. Exiting.")
      return

   # 2. Read the sheet once
   # try:
   sheet_data = sheets_updater.read_sheet_data()
   print("Loaded sheet data for batch update.")
   # except Exception as e:
   #    print(f"[ERROR] Failed to read sheet: {e}")
   #    return

   # 3. Process all PDF files and update in memory
   updates = []
   for file in pdf_files:
      file_id = file.get('id')
      file_name = file.get('name')
      print(f"\n---\nProcessing file: {file_name} (ID: {file_id})")
      try:
         local_path = drive_monitor.download_file(file_id, file_name)
      except Exception as e:
         print(f"[ERROR] Failed to download {file_name}: {e}")
         continue

      try:
         values = pdf_reader.extract_labs_from_pdf(local_path)
         # print("Extracted values:", values)
         updates.append(values)
      except Exception as e:
         print(f"[ERROR] Failed to extract labs from {file_name}: {e}")
         continue

   # 4. Write back to the sheet once
   sheets_updater.batch_update_sheet(sheet_data, updates)
   print("Batch sheet update complete.")

   # 5. Collect all unique column names and identify synonyms using ChatGPT
   print("\n--- Identifying duplicate/synonym column names...")
   all_metrics = sheets_updater.get_all_metric_names()
   print(f"Found {len(all_metrics)} unique metric names.")

   synonym_map = sheets_updater.identify_synonyms_with_ai(all_metrics)
   print(f"AI identified {len(synonym_map)} synonym mappings.")

   # 6. Consolidate duplicate columns based on AI mapping
   if synonym_map:
      sheets_updater.consolidate_columns(synonym_map)
      print("Column consolidation complete.")

   sheets_updater.rebuild_pivot_sheet()  # uses SHEET_NAME -> LOOKER_SHEET_NAME from config
   

if __name__ == "__main__":
    main()

"""
DEBUGGING GUIDELINES
====================
1. Google API credentials (credentials.json):
   - Place your credentials.json in the project root (recommended) or specify the path in src/config.py.
   - If you place it in the root, set GOOGLE_CREDENTIALS_FILE = "credentials.json"
   - If you place it in src/, set GOOGLE_CREDENTIALS_FILE = "src/credentials.json"
   - If you get authentication errors, re-download credentials from Google Cloud Console.

2. Google Drive connection:
   - If listing files fails, check DRIVE_FOLDER_ID in src/config.py and permissions in credentials.json.
   - Use print statements in src/drive_monitor.py to debug API responses.

3. OpenAI API:
   - Set OPENAI_API_KEY in src/config.py.
   - If extraction fails, print the OpenAI API response in src/pdf_reader.py.

4. Google Sheets:
   - Set SHEET_ID in src/config.py.
   - If updating fails, check worksheet name and permissions.

5. General:
   - Use print statements liberally to debug each step.
   - Check requirements.txt for missing packages.
"""
