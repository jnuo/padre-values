
import os
import base64
import json
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
    cache_path = pdf_path + ".labs.json"
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    client = OpenAI(api_key=OPENAI_API_KEY)

    def page_to_b64(page, dpi=220):
        """Convert a PDF page to a base64 PNG image string."""
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        return "data:image/png;base64," + base64.b64encode(pix.tobytes("png")).decode()

    out = {"sample_date": None, "tests": {}}
    with fitz.open(pdf_path) as doc:
        for page in doc:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
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
            data = json.loads(resp.choices[0].message.content)
            # Merge tests from each page
            out["tests"].update(data.get("tests", {}))
            # Keep the first non-empty sample_date
            if not out["sample_date"]:
                out["sample_date"] = data.get("sample_date")

    # Save result for future reuse
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    return out
