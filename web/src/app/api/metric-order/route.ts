import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default profile name for migrated data
const DEFAULT_PROFILE_NAME = "Yüksel O.";

/**
 * GET /api/metric-order?profileName=X
 * Returns array of metric names in display_order
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileName = searchParams.get("profileName") || DEFAULT_PROFILE_NAME;

    // Find the profile
    const profiles = await sql`
      SELECT id FROM profiles WHERE display_name = ${profileName}
    `;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ order: [] });
    }

    const profileId = profiles[0].id;

    // Get metric definitions ordered by display_order
    const definitions = await sql`
      SELECT name, display_order
      FROM metric_definitions
      WHERE profile_id = ${profileId}
      ORDER BY display_order ASC, name ASC
    `;

    const order = (definitions || []).map((d) => (d as { name: string }).name);

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
 * Body: { profileName?: string, order: string[] }
 * Updates display_order in metric_definitions
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const profileName = body.profileName || DEFAULT_PROFILE_NAME;
    const order: unknown = body.order;

    if (!Array.isArray(order)) {
      return NextResponse.json(
        { error: "order must be an array of metric names" },
        { status: 400 },
      );
    }

    // Find the profile
    const profiles = await sql`
      SELECT id FROM profiles WHERE display_name = ${profileName}
    `;

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profileId = profiles[0].id;

    // Update display_order for each metric
    let updated = 0;
    for (let i = 0; i < order.length; i++) {
      const name = order[i];
      await sql`
        UPDATE metric_definitions
        SET display_order = ${i}
        WHERE profile_id = ${profileId} AND name = ${name}
      `;
      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error("/api/metric-order PUT error", error);
    return NextResponse.json(
      { error: "Failed to update metric order" },
      { status: 500 },
    );
  }
}
