import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth, hasProfileAccess } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/cleanup?profileId=xxx
 * Delete all data for a profile (for testing)
 */
export async function DELETE(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId required" },
        { status: 400 },
      );
    }

    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete in order: metrics -> reports -> processed_files -> pending_uploads
    await sql`
      DELETE FROM metrics WHERE report_id IN (
        SELECT id FROM reports WHERE profile_id = ${profileId}
      )
    `;

    await sql`DELETE FROM reports WHERE profile_id = ${profileId}`;

    await sql`DELETE FROM processed_files WHERE profile_id = ${profileId}`;

    await sql`DELETE FROM pending_uploads WHERE profile_id = ${profileId}`;

    console.log(`[API] Cleanup for profile ${profileId}: all data deleted`);

    return NextResponse.json({
      success: true,
      message: "Profile data cleaned up",
    });
  } catch (error) {
    console.error("[API] Cleanup error:", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
