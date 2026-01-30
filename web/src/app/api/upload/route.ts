import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId, hasProfileAccess } from "@/lib/auth";
import { sql } from "@/lib/db";
import { put } from "@vercel/blob";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/upload
 * Upload a PDF file for processing
 *
 * Request: FormData with:
 * - file: PDF file
 * - profileId: UUID of the profile to upload to
 *
 * Response: { uploadId, fileName, status }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to upload files" },
        { status: 401 },
      );
    }

    // Get dbId from session, or look up by email if not present
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const profileId = formData.get("profileId") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Bad Request", message: "No file provided" },
        { status: 400 },
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "Bad Request", message: "profileId is required" },
        { status: 400 },
      );
    }

    // Verify file is a PDF
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Bad Request", message: "Only PDF files are accepted" },
        { status: 400 },
      );
    }

    // Verify user has access to this profile
    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You don't have access to this profile",
        },
        { status: 403 },
      );
    }

    // Read file content and calculate hash
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentHash = crypto
      .createHash("sha256")
      .update(buffer)
      .digest("hex");

    // Check for duplicate uploads in processed_files
    const duplicateCheck = await sql`
      SELECT id, file_name, created_at::TEXT as uploaded_at
      FROM processed_files
      WHERE profile_id = ${profileId}
      AND content_hash = ${contentHash}
      LIMIT 1
    `;

    if (duplicateCheck.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate",
          message: "Bu dosya zaten yüklenmiş",
          existingFileName: duplicateCheck[0].file_name,
          existingSampleDate: duplicateCheck[0].uploaded_at,
        },
        { status: 409 },
      );
    }

    // Clean up any stuck pending uploads for same file
    await sql`
      DELETE FROM pending_uploads
      WHERE profile_id = ${profileId}
      AND content_hash = ${contentHash}
    `;

    const fileName = file.name || `upload-${Date.now()}.pdf`;
    let fileUrl: string;

    // Try Vercel Blob if token is configured, otherwise use data URL for local dev
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(
        `uploads/${profileId}/${contentHash}.pdf`,
        buffer,
        {
          access: "public",
          contentType: "application/pdf",
        },
      );
      fileUrl = blob.url;
    } else {
      // For local development: store as base64 data URL
      const base64 = buffer.toString("base64");
      fileUrl = `data:application/pdf;base64,${base64}`;
    }

    // Create pending_uploads record
    const result = await sql`
      INSERT INTO pending_uploads (user_id, profile_id, file_name, content_hash, file_url, status)
      VALUES (${userId}, ${profileId}, ${fileName}, ${contentHash}, ${fileUrl}, 'pending')
      RETURNING id
    `;

    const uploadId = result[0]?.id;
    if (!uploadId) {
      throw new Error("Failed to create upload record");
    }

    console.log(`[API] Upload created: ${uploadId} for profile ${profileId}`);

    return NextResponse.json(
      {
        uploadId,
        fileName,
        status: "pending",
        message:
          "File uploaded successfully. Call /api/upload/{id}/extract to process.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API] POST /api/upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * GET /api/upload
 * List pending uploads for the current user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getDbUserId(session);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    let uploads;
    if (profileId) {
      // Verify access
      const hasAccess = await hasProfileAccess(userId, profileId);
      if (!hasAccess) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "You don't have access to this profile",
          },
          { status: 403 },
        );
      }

      uploads = await sql`
        SELECT id, file_name, status, sample_date, error_message, created_at, updated_at
        FROM pending_uploads
        WHERE profile_id = ${profileId}
        AND user_id = ${userId}
        AND status NOT IN ('confirmed', 'rejected')
        ORDER BY created_at DESC
      `;
    } else {
      uploads = await sql`
        SELECT pu.id, pu.file_name, pu.status, pu.sample_date, pu.error_message,
               pu.created_at, pu.updated_at, pu.profile_id, p.display_name as profile_name
        FROM pending_uploads pu
        JOIN profiles p ON p.id = pu.profile_id
        WHERE pu.user_id = ${userId}
        AND pu.status NOT IN ('confirmed', 'rejected')
        ORDER BY pu.created_at DESC
      `;
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("[API] GET /api/upload error:", error);
    return NextResponse.json(
      { error: "Failed to fetch uploads", details: String(error) },
      { status: 500 },
    );
  }
}
