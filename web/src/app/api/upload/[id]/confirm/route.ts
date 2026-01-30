import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

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
      SELECT id, profile_id, file_name, content_hash, status
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

    for (const metric of body.metrics) {
      // Determine flag based on reference values
      let flag: string | null = null;
      if (metric.ref_low != null && metric.value < metric.ref_low) {
        flag = "L";
      } else if (metric.ref_high != null && metric.value > metric.ref_high) {
        flag = "H";
      } else if (metric.ref_low != null || metric.ref_high != null) {
        flag = "N";
      }

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
    }

    // Update or create metric_definitions for new metrics
    for (const metric of body.metrics) {
      await sql`
        INSERT INTO metric_definitions (profile_id, name, unit, ref_low, ref_high)
        VALUES (
          ${profileId},
          ${metric.name},
          ${metric.unit || null},
          ${metric.ref_low ?? null},
          ${metric.ref_high ?? null}
        )
        ON CONFLICT (profile_id, name) DO UPDATE
        SET
          unit = COALESCE(EXCLUDED.unit, metric_definitions.unit),
          ref_low = COALESCE(EXCLUDED.ref_low, metric_definitions.ref_low),
          ref_high = COALESCE(EXCLUDED.ref_high, metric_definitions.ref_high)
      `;
    }

    // Record in processed_files (to prevent duplicate uploads)
    try {
      await sql`
        INSERT INTO processed_files (profile_id, file_name, content_hash)
        VALUES (${profileId}, ${upload.file_name}, ${upload.content_hash})
        ON CONFLICT (content_hash) DO NOTHING
      `;
    } catch (e) {
      // Table might not have all columns, try minimal insert
      console.log("[API] processed_files insert warning:", e);
    }

    // Update pending upload status
    await sql`
      UPDATE pending_uploads
      SET status = 'confirmed', updated_at = NOW()
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
    console.error("[API] POST /api/upload/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm upload", details: String(error) },
      { status: 500 },
    );
  }
}
