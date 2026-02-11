import { NextResponse } from "next/server";
import { requireProfileOwner } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/profiles/[id]
 * Delete a profile (owner only). Cascades to all related data.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: profileId } = await params;
    const userId = await requireProfileOwner(profileId);
    if (!userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if profile has reports (extra safety)
    const reports = await sql`
      SELECT COUNT(*) as count FROM reports WHERE profile_id = ${profileId}
    `;
    const reportCount = parseInt(reports[0].count, 10);

    const result = await sql`
      DELETE FROM profiles WHERE id = ${profileId} RETURNING id, display_name
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Profil bulunamadı" }, { status: 404 });
    }

    console.log(
      `[API] Profile deleted: ${result[0].display_name} (${profileId}), had ${reportCount} reports`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/profiles/[id] error:", error);
    return NextResponse.json({ error: "Profil silinemedi" }, { status: 500 });
  }
}
