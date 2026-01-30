import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Client } from "@upstash/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/upload/[id]/extract
 * Enqueues extraction job to QStash for async processing
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

    // Enqueue the extraction job to QStash
    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) {
      // Fallback: no QStash configured, return error
      await sql`
        UPDATE pending_uploads
        SET status = 'error', error_message = 'QStash not configured', updated_at = NOW()
        WHERE id = ${uploadId}
      `;
      return NextResponse.json(
        { error: "QStash not configured" },
        { status: 500 },
      );
    }

    const client = new Client({ token: qstashToken });

    // Get the base URL for the worker endpoint
    const baseUrl =
      process.env.NEXTAUTH_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const workerUrl = `${baseUrl}/api/upload/${uploadId}/extract/worker`;

    console.log(`[Extract] Enqueuing job to QStash: ${workerUrl}`);

    await client.publishJSON({
      url: workerUrl,
      body: { uploadId },
      retries: 2,
    });

    console.log(`[Extract] Job enqueued for upload: ${uploadId}`);

    return NextResponse.json({
      uploadId,
      status: "extracting",
      message: "Extraction queued",
    });
  } catch (error) {
    console.error("[API] POST /api/upload/[id]/extract error:", error);
    return NextResponse.json(
      { error: "Failed to queue extraction", details: String(error) },
      { status: 500 },
    );
  }
}
