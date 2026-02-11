import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth, hasProfileAccess } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tracking?profileId=xxx&type=blood_pressure&limit=50
 */
export async function GET(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const type = searchParams.get("type");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

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

    const measurements = type
      ? await sql`
          SELECT id, profile_id, type, measured_at, systolic, diastolic, pulse, weight_kg, notes, created_at
          FROM tracking_measurements
          WHERE profile_id = ${profileId} AND type = ${type}
          ORDER BY measured_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, profile_id, type, measured_at, systolic, diastolic, pulse, weight_kg, notes, created_at
          FROM tracking_measurements
          WHERE profile_id = ${profileId}
          ORDER BY measured_at DESC
          LIMIT ${limit}
        `;

    return NextResponse.json({ measurements });
  } catch (error) {
    console.error("/api/tracking GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch measurements" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tracking
 * Body: { profileId, type, systolic?, diastolic?, pulse?, weightKg?, notes?, measuredAt? }
 */
export async function POST(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      profileId,
      type,
      systolic,
      diastolic,
      pulse,
      weightKg,
      notes,
      measuredAt,
    } = body;

    if (!profileId || !type) {
      return NextResponse.json(
        { error: "profileId and type are required" },
        { status: 400 },
      );
    }

    if (type !== "blood_pressure" && type !== "weight") {
      return NextResponse.json(
        { error: "type must be 'blood_pressure' or 'weight'" },
        { status: 400 },
      );
    }

    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validate based on type
    if (type === "blood_pressure") {
      if (!systolic || !diastolic) {
        return NextResponse.json(
          { error: "systolic and diastolic are required for blood pressure" },
          { status: 400 },
        );
      }
      if (
        systolic < 50 ||
        systolic > 300 ||
        diastolic < 20 ||
        diastolic > 200
      ) {
        return NextResponse.json(
          { error: "Blood pressure values out of valid range" },
          { status: 400 },
        );
      }
      if (
        pulse !== undefined &&
        pulse !== null &&
        (pulse < 20 || pulse > 250)
      ) {
        return NextResponse.json(
          { error: "Pulse value out of valid range" },
          { status: 400 },
        );
      }
    }

    if (type === "weight") {
      if (!weightKg) {
        return NextResponse.json(
          { error: "weightKg is required for weight" },
          { status: 400 },
        );
      }
      if (weightKg < 1 || weightKg > 500) {
        return NextResponse.json(
          { error: "Weight value out of valid range" },
          { status: 400 },
        );
      }
    }

    const measuredAtValue = measuredAt
      ? new Date(measuredAt).toISOString()
      : new Date().toISOString();

    const result = await sql`
      INSERT INTO tracking_measurements (profile_id, type, measured_at, systolic, diastolic, pulse, weight_kg, notes)
      VALUES (
        ${profileId},
        ${type},
        ${measuredAtValue},
        ${type === "blood_pressure" ? systolic : null},
        ${type === "blood_pressure" ? diastolic : null},
        ${type === "blood_pressure" ? pulse || null : null},
        ${type === "weight" ? weightKg : null},
        ${notes || null}
      )
      RETURNING id, profile_id, type, measured_at, systolic, diastolic, pulse, weight_kg, notes, created_at
    `;

    return NextResponse.json({ measurement: result[0] }, { status: 201 });
  } catch (error) {
    console.error("/api/tracking POST error:", error);
    return NextResponse.json(
      { error: "Failed to save measurement" },
      { status: 500 },
    );
  }
}
