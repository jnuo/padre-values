
import os
import base64
import json
import time
import fitz  # pymupdf
from openai import OpenAI
from src.config import OPENAI_API_KEY

PROMPT = (
    "Aşağıdaki laboratuvar sayfasından TÜM güncel 'Sonuç' değerlerini çıkar.\n"
    "Kurallar:\n"
    "- Parantezli eski sonuçları alma.\n"
    "- 10,7 → 10.7 nokta yap.\n"
    "- H/L bayrağını 'flag' alanına yaz.\n"
    "- % ve # ayrı anahtar (örn: Nötrofil% / Nötrofil#).\n"
    "- 'Numune Alım Tarihi'ni tespit et ve sadece tarihi ISO 'YYYY-MM-DD' formatında ver (saatleri atla).\n"
    "- Her test için mümkünse referans aralığını çıkar: alt sınır ve üst sınır.\n"
    "- Referans aralığı mevcutsa 'ref_low' ve 'ref_high' alanlarını doldur. Yoksa boş bırak.\n"
    "- ÇIKTI: sadece JSON -> {\"sample_date\": \"<YYYY-MM-DD|null>\", \"tests\": { \"<Ad>\": { \"value\": <number>, \"unit\": \"<unit|null>\", \"flag\": \"<H|L|N|null>\", \"ref_low\": <number|null>, \"ref_high\": <number|null> } } }}"
)

def extract_labs_from_pdf(pdf_path: str, dpi: int = 220) -> dict:
    """
    Extracts lab values from a PDF file using OpenAI GPT (image-based extraction).
    Caches the result as a .labs.json file next to the PDF for future runs.
    Only calls OpenAI if the cache does not exist.
    Args:
        pdf_path: Path to the PDF file.
        dpi: Resolution for page image conversion (default 220).
    Returns:
        Dictionary with 'sample_date' and 'tests' keys.
    """
    file_name = os.path.basename(pdf_path)
    cache_path = pdf_path + ".labs.json"

    # Check cache first
    if os.path.exists(cache_path):
        print(f"  📋 Cache hit: {file_name}")
        with open(cache_path, "r", encoding="utf-8") as f:
            cached = json.load(f)
            print(f"     → {len(cached.get('tests', {}))} tests, date: {cached.get('sample_date')}")
            return cached

    print(f"  🤖 Calling OpenAI API for: {file_name}")
    start_time = time.time()

    client = OpenAI(api_key=OPENAI_API_KEY)

    def page_to_b64(page, dpi=220):
        """Convert a PDF page to a base64 PNG image string."""
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        return "data:image/png;base64," + base64.b64encode(pix.tobytes("png")).decode()

    out = {"sample_date": None, "tests": {}}
    with fitz.open(pdf_path) as doc:
        num_pages = len(doc)
        print(f"     → Processing {num_pages} page(s)...")

        for page_num, page in enumerate(doc, 1):
            page_start = time.time()
            resp = client.chat.completions.create(
                model="gpt-5-mini",
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=4000,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": page_to_b64(page, dpi=dpi)}},
                    ],
                }],
            )
            page_time = time.time() - page_start
            data = json.loads(resp.choices[0].message.content)
            tests_found = len(data.get("tests", {}))
            print(f"     → Page {page_num}/{num_pages}: {tests_found} tests ({page_time:.1f}s)")

            # Merge tests from each page
            out["tests"].update(data.get("tests", {}))
            # Keep the first non-empty sample_date
            if not out["sample_date"]:
                out["sample_date"] = data.get("sample_date")

    total_time = time.time() - start_time
    print(f"  ✅ Extracted {len(out['tests'])} tests, date: {out['sample_date']} ({total_time:.1f}s total)")

    # Save result for future reuse
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"  💾 Cached to: {os.path.basename(cache_path)}")

    return out
