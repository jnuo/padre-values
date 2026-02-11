import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth, hasProfileAccess } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/tracking/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get measurement to check profile access
    const measurement = await sql`
      SELECT profile_id FROM tracking_measurements WHERE id = ${id}
    `;

    if (measurement.length === 0) {
      return NextResponse.json(
        { error: "Measurement not found" },
        { status: 404 },
      );
    }

    const hasAccess = await hasProfileAccess(userId, measurement[0].profile_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await sql`DELETE FROM tracking_measurements WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/tracking/[id] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete measurement" },
      { status: 500 },
    );
  }
}
