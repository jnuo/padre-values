import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/cleanup?profileId=xxx
 * Delete all data for a profile (for testing)
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId = getDbUserId(session);
    if (!userId) {
      const users =
        await sql`SELECT id FROM users WHERE email = ${session.user.email}`;
      if (users.length > 0) userId = users[0].id;
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId required" },
        { status: 400 },
      );
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
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
