import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // QStash can wait up to 5 minutes

const EXTRACTION_PROMPT = `Aşağıdaki laboratuvar sayfasından TÜM güncel 'Sonuç' değerlerini çıkar.

Kurallar:
- Parantezli eski sonuçları alma.
- 10,7 → 10.7 nokta yap.
- H/L bayrağını 'flag' alanına yaz.
- % ve # ayrı anahtar (örn: Nötrofil% / Nötrofil#).
- 'Numune Alım Tarihi'ni tespit et ve sadece tarihi ISO 'YYYY-MM-DD' formatında ver (saatleri atla).
- Her test için mümkünse referans aralığını çıkar: alt sınır ve üst sınır.
- Referans aralığı mevcutsa 'ref_low' ve 'ref_high' alanlarını doldur. Yoksa boş bırak.

ÖNEMLİ - Test İsimlerini Türkçeye Çevir:
- Rapor hangi dilde olursa olsun (İspanyolca, İngilizce, Almanca vb.), test isimlerini Türkçe tıbbi terminolojiye çevir.
- Örnek çeviriler:
  - Hemoglobin → Hemoglobin
  - Hematocrit/Hematocrito → Hematokrit
  - Red Blood Cells/Eritrocitos → Eritrosit
  - White Blood Cells/Leucocitos → Lökosit
  - Platelets/Plaquetas → Trombosit
  - Glucose/Glucosa → Glukoz
  - Cholesterol/Colesterol → Kolesterol
  - Triglycerides/Triglicéridos → Trigliserit
  - Urea → Üre
  - Creatinine/Creatinina → Kreatinin
  - ALT/GPT → ALT
  - AST/GOT → AST
  - TSH → TSH
  - T3/T4 → T3/T4
  - Iron/Hierro → Demir
  - Ferritin/Ferritina → Ferritin
  - Vitamin D → D Vitamini
  - Vitamin B12 → B12 Vitamini
- Bilinmeyen testler için orijinal ismi koru.

ÇIKTI: sadece JSON -> {"sample_date": "<YYYY-MM-DD|null>", "tests": { "<Türkçe Ad>": { "value": <number>, "unit": "<unit|null>", "flag": "<H|L|N|null>", "ref_low": <number|null>, "ref_high": <number|null> } } }}`;

interface ExtractedTest {
  value: number;
  unit?: string | null;
  flag?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
}

interface PageExtractionResult {
  sample_date: string | null;
  tests: Record<string, ExtractedTest>;
}

interface ExtractedMetric {
  name: string;
  value: number;
  unit?: string;
  ref_low?: number | null;
  ref_high?: number | null;
}

interface ExtractionResult {
  sample_date: string | null;
  metrics: ExtractedMetric[];
}

async function pdfToImages(buffer: Buffer): Promise<string[]> {
  const mupdf = await import("mupdf");
  const images: string[] = [];
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  const pageCount = doc.countPages();

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const scale = 2.5;
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    const pngData = pixmap.asPNG();
    const base64 = Buffer.from(pngData).toString("base64");
    images.push(`data:image/png;base64,${base64}`);
  }

  return images;
}

async function handler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: uploadId } = await params;

  try {
    console.log(`[Worker] Starting extraction for upload: ${uploadId}`);

    const uploads = await sql`
      SELECT id, profile_id, file_url, status, user_id
      FROM pending_uploads
      WHERE id = ${uploadId}
    `;

    if (uploads.length === 0) {
      console.error(`[Worker] Upload not found: ${uploadId}`);
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const upload = uploads[0];

    if (upload.status !== "extracting") {
      console.log(
        `[Worker] Upload ${uploadId} is not in extracting status: ${upload.status}`,
      );
      return NextResponse.json({ status: upload.status });
    }

    try {
      let pdfBuffer: Buffer;

      if (upload.file_url.startsWith("data:")) {
        const base64Data = upload.file_url.split(",")[1];
        pdfBuffer = Buffer.from(base64Data, "base64");
      } else {
        const pdfResponse = await fetch(upload.file_url);
        if (!pdfResponse.ok) {
          throw new Error("Failed to fetch PDF from storage");
        }
        pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      }

      console.log(`[Worker] Converting PDF to images...`);
      const pageImages = await pdfToImages(pdfBuffer);
      console.log(`[Worker] Got ${pageImages.length} page(s)`);

      if (pageImages.length === 0) {
        throw new Error("PDF has no pages");
      }

      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OpenAI API key not configured");
      }

      const mergedResult: PageExtractionResult = {
        sample_date: null,
        tests: {},
      };

      for (let i = 0; i < pageImages.length; i++) {
        console.log(
          `[Worker] Processing page ${i + 1}/${pageImages.length}...`,
        );

        const openaiResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: EXTRACTION_PROMPT },
                    {
                      type: "image_url",
                      image_url: { url: pageImages[i] },
                    },
                  ],
                },
              ],
              max_tokens: 4000,
              response_format: { type: "json_object" },
            }),
          },
        );

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json();
          throw new Error(
            `OpenAI API error: ${errorData.error?.message || "Unknown error"}`,
          );
        }

        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content;

        if (!content) {
          console.log(`[Worker] Page ${i + 1}: No content returned`);
          continue;
        }

        let pageData: PageExtractionResult;
        try {
          pageData = JSON.parse(content);
        } catch {
          console.log(`[Worker] Page ${i + 1}: Failed to parse JSON`);
          continue;
        }

        if (pageData.tests) {
          const testCount = Object.keys(pageData.tests).length;
          console.log(`[Worker] Page ${i + 1}: Found ${testCount} tests`);
          Object.assign(mergedResult.tests, pageData.tests);
        }

        if (!mergedResult.sample_date && pageData.sample_date) {
          mergedResult.sample_date = pageData.sample_date;
        }
      }

      const metrics: ExtractedMetric[] = Object.entries(mergedResult.tests).map(
        ([name, test]) => ({
          name,
          value: test.value,
          unit: test.unit || undefined,
          ref_low: test.ref_low,
          ref_high: test.ref_high,
        }),
      );

      const extractedData: ExtractionResult = {
        sample_date: mergedResult.sample_date,
        metrics,
      };

      if (metrics.length === 0) {
        throw new Error("No test results could be extracted from the PDF");
      }

      await sql`
        UPDATE pending_uploads
        SET
          status = 'review',
          extracted_data = ${JSON.stringify(extractedData)},
          sample_date = ${extractedData.sample_date || null},
          updated_at = NOW()
        WHERE id = ${uploadId}
      `;

      console.log(
        `[Worker] Extraction completed: ${uploadId}, ${metrics.length} metrics`,
      );

      return NextResponse.json({
        uploadId,
        status: "review",
        metricCount: metrics.length,
      });
    } catch (extractionError) {
      reportError(extractionError, { op: "worker.extraction", uploadId });

      await sql`
        UPDATE pending_uploads
        SET
          status = 'pending',
          error_message = 'Veri çıkarma başarısız',
          updated_at = NOW()
        WHERE id = ${uploadId}
      `;

      return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
    }
  } catch (error) {
    reportError(error, { op: "worker.handler", uploadId });
    return NextResponse.json({ error: "Worker failed" }, { status: 500 });
  }
}

const isLocalDev = process.env.NODE_ENV === "development";

// In production, verify QStash signature. During build or local dev, skip.
// verifySignatureAppRouter reads keys at import time, so only call it when keys exist.
export const POST =
  isLocalDev || !process.env.QSTASH_CURRENT_SIGNING_KEY
    ? async (...args: Parameters<typeof handler>) => {
        // Fail-closed: if running in production without signing key, reject
        if (!isLocalDev && !process.env.QSTASH_CURRENT_SIGNING_KEY) {
          return NextResponse.json(
            { error: "Server misconfigured" },
            { status: 500 },
          );
        }
        return handler(...args);
      }
    : verifySignatureAppRouter(handler);
