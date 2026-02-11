import { NextResponse } from "next/server";
import { requireAuth, getProfileAccessLevel } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/profiles/[id]/leave
 * Remove yourself from a shared profile (non-owners only)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: profileId } = await params;
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = await getProfileAccessLevel(userId, profileId);
    if (!accessLevel) {
      return NextResponse.json(
        { error: "Bu profile erişiminiz yok" },
        { status: 404 },
      );
    }

    if (accessLevel === "owner") {
      return NextResponse.json(
        { error: "Profil sahibi profilden ayrılamaz" },
        { status: 400 },
      );
    }

    // Remove user_access
    await sql`
      DELETE FROM user_access
      WHERE user_id_new = ${userId} AND profile_id = ${profileId}
    `;

    // Clean up profile_allowed_emails
    const user = await sql`
      SELECT email FROM users WHERE id = ${userId}
    `;
    if (user.length > 0) {
      await sql`
        DELETE FROM profile_allowed_emails
        WHERE profile_id = ${profileId} AND LOWER(email) = LOWER(${user[0].email})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/profiles/[id]/leave error:", error);
    return NextResponse.json(
      { error: "Profilden ayrılınamadı" },
      { status: 500 },
    );
  }
}
