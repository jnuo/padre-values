import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for PDF processing + OpenAI

// Extraction prompt - extracts lab values and normalizes names to Turkish
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

/**
 * Convert PDF buffer to array of base64-encoded PNG images (one per page)
 * Uses MuPDF (same library as Python version) via WebAssembly
 */
async function pdfToImages(buffer: Buffer): Promise<string[]> {
  const mupdf = await import("mupdf");

  const images: string[] = [];

  // Open the PDF document
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  const pageCount = doc.countPages();

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    // Render at ~180 DPI (default is 72 DPI, so scale by ~2.5)
    const scale = 2.5;
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false, // no alpha
      true, // annots
    );

    // Convert to PNG
    const pngData = pixmap.asPNG();
    const base64 = Buffer.from(pngData).toString("base64");
    images.push(`data:image/png;base64,${base64}`);
  }

  return images;
}

/**
 * POST /api/upload/[id]/extract
 * Extract data from an uploaded PDF using AI vision
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in" },
        { status: 401 },
      );
    }

    let userId = getDbUserId(session);
    if (!userId) {
      const users =
        await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
      if (users.length > 0) userId = users[0].id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Could not identify user" },
        { status: 401 },
      );
    }

    const { id: uploadId } = await params;

    // Get the pending upload
    const uploads = await sql`
      SELECT id, profile_id, file_url, status
      FROM pending_uploads
      WHERE id = ${uploadId}
      AND user_id = ${userId}
    `;

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "Not Found", message: "Upload not found" },
        { status: 404 },
      );
    }

    const upload = uploads[0];

    if (upload.status !== "pending") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: `Upload is already in status: ${upload.status}`,
        },
        { status: 400 },
      );
    }

    // Update status to extracting
    await sql`
      UPDATE pending_uploads
      SET status = 'extracting', updated_at = NOW()
      WHERE id = ${uploadId}
    `;

    try {
      let pdfBuffer: Buffer;

      // Handle data URLs (local dev) vs Vercel Blob URLs
      if (upload.file_url.startsWith("data:")) {
        // Parse base64 data URL
        const base64Data = upload.file_url.split(",")[1];
        pdfBuffer = Buffer.from(base64Data, "base64");
      } else {
        // Fetch PDF from Vercel Blob
        const pdfResponse = await fetch(upload.file_url);
        if (!pdfResponse.ok) {
          throw new Error("Failed to fetch PDF from storage");
        }
        pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      }

      // Convert PDF pages to images
      console.log(`[Extract] Converting PDF to images...`);
      const pageImages = await pdfToImages(pdfBuffer);
      console.log(`[Extract] Got ${pageImages.length} page(s)`);

      if (pageImages.length === 0) {
        throw new Error("PDF has no pages");
      }

      // Call OpenAI for extraction using vision
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OpenAI API key not configured");
      }

      // Process each page and merge results
      const mergedResult: PageExtractionResult = {
        sample_date: null,
        tests: {},
      };

      for (let i = 0; i < pageImages.length; i++) {
        console.log(
          `[Extract] Processing page ${i + 1}/${pageImages.length}...`,
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
          console.log(`[Extract] Page ${i + 1}: No content returned`);
          continue;
        }

        // Parse the JSON response
        let pageData: PageExtractionResult;
        try {
          pageData = JSON.parse(content);
        } catch {
          console.log(`[Extract] Page ${i + 1}: Failed to parse JSON`);
          continue;
        }

        // Merge tests from this page
        if (pageData.tests) {
          const testCount = Object.keys(pageData.tests).length;
          console.log(`[Extract] Page ${i + 1}: Found ${testCount} tests`);
          Object.assign(mergedResult.tests, pageData.tests);
        }

        // Keep the first non-null sample_date
        if (!mergedResult.sample_date && pageData.sample_date) {
          mergedResult.sample_date = pageData.sample_date;
        }
      }

      // Convert from Python format to our expected format
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

      // Validate the result
      if (metrics.length === 0) {
        throw new Error("No test results could be extracted from the PDF");
      }

      // Resolve metric aliases if available
      const profileId = upload.profile_id;
      const aliasMap = new Map<string, string>();

      try {
        const aliases = await sql`
          SELECT alias, canonical_name
          FROM metric_aliases
          WHERE profile_id = ${profileId}
        `;

        for (const alias of aliases) {
          aliasMap.set(alias.alias.toLowerCase(), alias.canonical_name);
        }
      } catch {
        // Ignore if metric_aliases table doesn't exist
        console.log("[Extract] No metric_aliases table or data");
      }

      // Apply aliases to metric names
      const normalizedMetrics = extractedData.metrics.map((metric) => {
        const lowerName = metric.name.toLowerCase();
        const canonicalName = aliasMap.get(lowerName) || metric.name;
        return {
          ...metric,
          name: canonicalName,
        };
      });

      extractedData.metrics = normalizedMetrics;

      // Update the pending upload with extracted data
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
        `[API] Extraction completed: ${uploadId}, ${normalizedMetrics.length} metrics`,
      );

      return NextResponse.json({
        uploadId,
        status: "review",
        extractedData,
        metricCount: normalizedMetrics.length,
      });
    } catch (extractionError) {
      // Update status to pending with error message
      await sql`
        UPDATE pending_uploads
        SET
          status = 'pending',
          error_message = ${String(extractionError)},
          updated_at = NOW()
        WHERE id = ${uploadId}
      `;

      throw extractionError;
    }
  } catch (error) {
    console.error("[API] POST /api/upload/[id]/extract error:", error);
    return NextResponse.json(
      { error: "Failed to extract data", details: String(error) },
      { status: 500 },
    );
  }
}
