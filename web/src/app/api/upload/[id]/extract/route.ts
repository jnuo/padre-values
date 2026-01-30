import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { PDFParse, type LoadParameters } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extraction prompt for OpenAI
const EXTRACTION_PROMPT = `You are a medical document parser. Extract blood test results from this Turkish lab report PDF.

Return a JSON object with this exact structure:
{
  "sample_date": "YYYY-MM-DD", // The date when the blood sample was taken
  "metrics": [
    {
      "name": "Metric Name", // Keep the Turkish name exactly as shown
      "value": 12.5, // Numeric value
      "unit": "g/dL", // Unit of measurement
      "ref_low": 11.5, // Lower reference bound (null if not shown)
      "ref_high": 16.0 // Upper reference bound (null if not shown)
    }
  ]
}

Important:
- Extract ALL metrics from the report
- Keep metric names in Turkish as they appear
- Convert comma decimals to dots (12,5 → 12.5)
- Parse date formats like "15.01.2024" to "2024-01-15"
- If you can't find the sample date, use null
- If reference ranges are shown as "11.5-16.0", split into ref_low and ref_high
- Return ONLY the JSON, no markdown or explanations`;

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
 * POST /api/upload/[id]/extract
 * Extract data from an uploaded PDF using AI
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getDbUserId(session);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in" },
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
      // Fetch PDF from Vercel Blob
      const pdfResponse = await fetch(upload.file_url);
      if (!pdfResponse.ok) {
        throw new Error("Failed to fetch PDF from storage");
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

      // Extract text from PDF using pdf-parse
      const loadOptions: LoadParameters = { data: new Uint8Array(pdfBuffer) };
      const pdf = new PDFParse(loadOptions);
      const textResult = await pdf.getText();
      const pdfText = textResult.text;

      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error(
          "Could not extract text from PDF. The file may be image-based.",
        );
      }

      // Call OpenAI for extraction
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OpenAI API key not configured");
      }

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
              { role: "system", content: EXTRACTION_PROMPT },
              { role: "user", content: pdfText },
            ],
            temperature: 0.1,
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
      const extractedContent = openaiData.choices?.[0]?.message?.content;

      if (!extractedContent) {
        throw new Error("No content returned from OpenAI");
      }

      // Parse the JSON response
      let extractedData: ExtractionResult;
      try {
        extractedData = JSON.parse(extractedContent);
      } catch {
        throw new Error("Failed to parse OpenAI response as JSON");
      }

      // Validate the structure
      if (!extractedData.metrics || !Array.isArray(extractedData.metrics)) {
        throw new Error("Invalid extraction result: missing metrics array");
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
