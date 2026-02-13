import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth, hasProfileAccess } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/metric-order?profileId=xxx
 * Returns array of metric names in display_order
 */
export async function GET(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const preferences = await sql`
      SELECT name, display_order
      FROM metric_preferences
      WHERE profile_id = ${profileId}
      ORDER BY display_order ASC, name ASC
    `;

    const order = (preferences || []).map((d) => d.name);

    return NextResponse.json({ order });
  } catch (error) {
    console.error("/api/metric-order GET error", error);
    return NextResponse.json(
      { error: "Failed to fetch metric order" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/metric-order
 * Body: { profileId: string, order: string[] }
 * Updates display_order in metric_preferences
 */
export async function PUT(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const profileId: unknown = body.profileId;
    const order: unknown = body.order;

    if (!profileId || typeof profileId !== "string") {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(order)) {
      return NextResponse.json(
        { error: "order must be an array of metric names" },
        { status: 400 },
      );
    }

    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    for (let i = 0; i < order.length; i++) {
      await sql`
        UPDATE metric_preferences
        SET display_order = ${i}
        WHERE profile_id = ${profileId} AND name = ${order[i]}
      `;
    }

    return NextResponse.json({ success: true, updated: order.length });
  } catch (error) {
    console.error("/api/metric-order PUT error", error);
    return NextResponse.json(
      { error: "Failed to update metric order" },
      { status: 500 },
    );
  }
}
