import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ notifications: [] });
    }

    const rows = await sql`
      SELECT p.display_name as profile_name, u.name as granted_by_name, ua.access_level
      FROM user_access ua
      JOIN profiles p ON p.id = ua.profile_id
      LEFT JOIN users u ON u.id = ua.granted_by
      WHERE ua.user_id_new = ${userId}
      AND ua.notified_at IS NULL
      AND ua.granted_by IS DISTINCT FROM ua.user_id_new
    `;

    return NextResponse.json({ notifications: rows });
  } catch (error) {
    console.error("[API] GET /api/notifications error:", error);
    return NextResponse.json({ notifications: [] });
  }
}

export async function POST() {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await sql`
      UPDATE user_access
      SET notified_at = NOW()
      WHERE user_id_new = ${userId} AND notified_at IS NULL
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API] POST /api/notifications error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
