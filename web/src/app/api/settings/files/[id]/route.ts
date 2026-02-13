import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId, hasProfileAccess } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings/files/[id]
 * Get file details and all metrics for a processed file
 */
export async function GET(
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

    const { id: fileId } = await params;

    // Get the processed file
    const files = await sql`
      SELECT id, profile_id, file_name, content_hash, created_at
      FROM processed_files
      WHERE id = ${fileId}
    `;

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Not Found", message: "File not found" },
        { status: 404 },
      );
    }

    const file = files[0];

    // Verify user has access to this profile
    const hasAccess = await hasProfileAccess(userId, file.profile_id);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You don't have access to this file",
        },
        { status: 403 },
      );
    }

    // Get metrics for this file through reports
    const metrics = await sql`
      SELECT
        m.id,
        m.name,
        m.value,
        m.unit,
        m.ref_low,
        m.ref_high,
        m.flag,
        r.sample_date,
        r.id as report_id
      FROM metrics m
      JOIN reports r ON r.id = m.report_id
      WHERE r.profile_id = ${file.profile_id}
      AND r.file_name = ${file.file_name}
      ORDER BY m.name ASC
    `;

    return NextResponse.json({
      file: {
        id: file.id,
        file_name: file.file_name,
        created_at: file.created_at,
        sample_date: metrics[0]?.sample_date ?? null,
        profile_id: file.profile_id,
      },
      metrics,
    });
  } catch (error) {
    console.error("[API] GET /api/settings/files/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch file details" },
      { status: 500 },
    );
  }
}
