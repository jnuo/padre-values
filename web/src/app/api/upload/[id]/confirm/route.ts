import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { del } from "@vercel/blob";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ConfirmedMetric {
  name: string;
  value: number;
  unit?: string;
  ref_low?: number | null;
  ref_high?: number | null;
}

interface ConfirmRequest {
  sampleDate: string; // YYYY-MM-DD
  metrics: ConfirmedMetric[];
}

function isValidMetricValue(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

function determineFlag(
  value: number,
  refLow: number | null | undefined,
  refHigh: number | null | undefined,
): string | null {
  if (refLow != null && value < refLow) return "L";
  if (refHigh != null && value > refHigh) return "H";
  if (refLow != null || refHigh != null) return "N";
  return null;
}

/**
 * POST /api/upload/[id]/confirm
 * Confirm extracted data and save to database
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
        await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${session.user.email})`;
      if (users.length > 0) userId = users[0].id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Could not identify user" },
        { status: 401 },
      );
    }

    const { id: uploadId } = await params;
    const body = (await request.json()) as ConfirmRequest;

    if (!body.sampleDate) {
      return NextResponse.json(
        { error: "Bad Request", message: "sampleDate is required" },
        { status: 400 },
      );
    }

    if (
      !body.metrics ||
      !Array.isArray(body.metrics) ||
      body.metrics.length === 0
    ) {
      return NextResponse.json(
        { error: "Bad Request", message: "At least one metric is required" },
        { status: 400 },
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.sampleDate)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "sampleDate must be in YYYY-MM-DD format",
        },
        { status: 400 },
      );
    }

    // Get the pending upload
    const uploads = await sql`
      SELECT id, profile_id, file_name, content_hash, file_url, status
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

    if (upload.status !== "review") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: `Upload must be in 'review' status to confirm. Current: ${upload.status}`,
        },
        { status: 400 },
      );
    }

    const profileId = upload.profile_id;

    // Check if a report already exists for this profile and date
    const existingReports = await sql`
      SELECT id FROM reports
      WHERE profile_id = ${profileId}
      AND sample_date = ${body.sampleDate}
    `;

    let reportId: string;

    if (existingReports.length > 0) {
      // Use existing report
      reportId = existingReports[0].id;
      console.log(
        `[API] Using existing report: ${reportId} for date ${body.sampleDate}`,
      );
    } else {
      // Create new report
      const reportResult = await sql`
        INSERT INTO reports (profile_id, sample_date, file_name, source)
        VALUES (${profileId}, ${body.sampleDate}, ${upload.file_name}, 'pdf')
        RETURNING id
      `;
      reportId = reportResult[0]?.id;
      if (!reportId) {
        throw new Error("Failed to create report");
      }
      console.log(
        `[API] Created new report: ${reportId} for date ${body.sampleDate}`,
      );
    }

    // Insert metrics
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const metric of body.metrics) {
      if (!isValidMetricValue(metric.value)) {
        console.log(`[API] Skipping metric with invalid value: ${metric.name}`);
        skippedCount++;
        continue;
      }

      const flag = determineFlag(metric.value, metric.ref_low, metric.ref_high);

      // Insert or update metric
      const result = await sql`
        INSERT INTO metrics (report_id, name, value, unit, ref_low, ref_high, flag)
        VALUES (
          ${reportId},
          ${metric.name},
          ${metric.value},
          ${metric.unit || null},
          ${metric.ref_low ?? null},
          ${metric.ref_high ?? null},
          ${flag}
        )
        ON CONFLICT (report_id, name) DO UPDATE
        SET
          value = EXCLUDED.value,
          unit = COALESCE(EXCLUDED.unit, metrics.unit),
          ref_low = COALESCE(EXCLUDED.ref_low, metrics.ref_low),
          ref_high = COALESCE(EXCLUDED.ref_high, metrics.ref_high),
          flag = EXCLUDED.flag
        RETURNING (xmax = 0) as is_insert
      `;

      if (result[0]?.is_insert) {
        insertedCount++;
      } else {
        updatedCount++;
      }

      // Ensure metric_preferences row exists for display_order tracking
      await sql`
        INSERT INTO metric_preferences (profile_id, name)
        VALUES (${profileId}, ${metric.name})
        ON CONFLICT (profile_id, name) DO NOTHING
      `;
    }

    // Record in processed_files (to prevent duplicate uploads)
    try {
      await sql`
        INSERT INTO processed_files (profile_id, file_name, content_hash)
        VALUES (${profileId}, ${upload.file_name}, ${upload.content_hash})
        ON CONFLICT (profile_id, content_hash) DO UPDATE
        SET file_name = EXCLUDED.file_name, created_at = NOW()
      `;
      console.log(`[API] processed_files recorded: ${upload.file_name}`);
    } catch (e) {
      reportError(e, { op: "upload.confirm.processedFiles", uploadId });
    }

    // Delete PDF from Vercel Blob storage BEFORE clearing file_url
    // This ensures we don't lose the reference if deletion fails
    let blobDeleted = false;
    if (upload.file_url && upload.file_url.startsWith("https://")) {
      try {
        await del(upload.file_url);
        console.log(`[API] Deleted blob: ${upload.file_url}`);
        blobDeleted = true;
      } catch (blobError) {
        reportError(blobError, {
          op: "upload.confirm.deleteBlob",
          uploadId,
          fileUrl: upload.file_url,
        });
      }
    }

    // Update pending upload status, only clear file_url if blob was deleted
    await sql`
      UPDATE pending_uploads
      SET status = 'confirmed',
          file_url = ${blobDeleted ? null : upload.file_url},
          updated_at = NOW()
      WHERE id = ${uploadId}
    `;

    console.log(
      `[API] Upload confirmed: ${uploadId}, ${insertedCount} inserted, ${updatedCount} updated`,
    );

    return NextResponse.json({
      success: true,
      reportId,
      sampleDate: body.sampleDate,
      metricsInserted: insertedCount,
      metricsUpdated: updatedCount,
    });
  } catch (error) {
    reportError(error, { op: "upload.confirm.POST" });
    return NextResponse.json(
      { error: "Failed to confirm upload", details: String(error) },
      { status: 500 },
    );
  }
}
