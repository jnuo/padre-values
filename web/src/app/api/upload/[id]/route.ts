import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/upload/[id]
 * Get details of a specific upload
 */
export async function GET(
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

    const uploads = await sql`
      SELECT
        pu.id,
        pu.file_name,
        pu.status,
        pu.sample_date,
        pu.extracted_data,
        pu.error_message,
        pu.created_at,
        pu.updated_at,
        pu.profile_id,
        p.display_name as profile_name
      FROM pending_uploads pu
      JOIN profiles p ON p.id = pu.profile_id
      WHERE pu.id = ${uploadId}
      AND pu.user_id = ${userId}
    `;

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "Not Found", message: "Upload not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ upload: uploads[0] });
  } catch (error) {
    console.error("[API] GET /api/upload/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/upload/[id]
 * Reject/cancel an upload
 */
export async function DELETE(
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

    // Get the upload
    const uploads = await sql`
      SELECT id, file_url, status
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

    if (upload.status === "confirmed") {
      return NextResponse.json(
        { error: "Bad Request", message: "Cannot delete a confirmed upload" },
        { status: 400 },
      );
    }

    // Delete from Vercel Blob if URL exists
    if (upload.file_url) {
      try {
        await del(upload.file_url);
      } catch (blobError) {
        console.error("[API] Failed to delete blob:", blobError);
        // Continue anyway - blob deletion is not critical
      }
    }

    // Update status to rejected (or delete the record entirely)
    await sql`
      UPDATE pending_uploads
      SET status = 'rejected', updated_at = NOW()
      WHERE id = ${uploadId}
    `;

    console.log(`[API] Upload rejected: ${uploadId}`);

    return NextResponse.json({ success: true, uploadId });
  } catch (error) {
    console.error("[API] DELETE /api/upload/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete upload" },
      { status: 500 },
    );
  }
}
