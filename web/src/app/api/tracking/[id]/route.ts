import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth, getProfileAccessLevel } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function getMeasurementAndCheckAccess(
  userId: string,
  id: string,
  requiredLevels: string[],
) {
  const rows = await sql`
    SELECT profile_id, type FROM tracking_measurements WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return {
      error: NextResponse.json(
        { error: "Measurement not found" },
        { status: 404 },
      ),
    };
  }

  const level = await getProfileAccessLevel(userId, rows[0].profile_id);
  if (!level || !requiredLevels.includes(level)) {
    return {
      error: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    };
  }

  return { measurement: rows[0], level };
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await getMeasurementAndCheckAccess(userId, id, [
      "owner",
      "editor",
    ]);
    if (result.error) return result.error;

    const body = await request.json();
    const { weightKg, systolic, diastolic, pulse } = body;
    const notesRaw = body.notes;
    const notes = typeof notesRaw === "string" ? notesRaw.slice(0, 500) : null;
    const { type } = result.measurement!;

    if (type === "weight") {
      if (weightKg == null) {
        return NextResponse.json(
          { error: "weightKg is required" },
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

    if (type === "blood_pressure") {
      if (systolic == null || diastolic == null) {
        return NextResponse.json(
          { error: "systolic and diastolic are required" },
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
      if (pulse != null && (pulse < 20 || pulse > 250)) {
        return NextResponse.json(
          { error: "Pulse value out of valid range" },
          { status: 400 },
        );
      }
    }

    const updated = await sql`
      UPDATE tracking_measurements
      SET
        weight_kg = ${type === "weight" ? weightKg : null},
        systolic = ${type === "blood_pressure" ? systolic : null},
        diastolic = ${type === "blood_pressure" ? diastolic : null},
        pulse = ${type === "blood_pressure" ? (pulse ?? null) : null},
        notes = ${notes ?? null}
      WHERE id = ${id}
      RETURNING id, profile_id, type, measured_at, systolic, diastolic, pulse, weight_kg, notes, created_at
    `;

    return NextResponse.json({ measurement: updated[0] });
  } catch (error) {
    console.error("/api/tracking/[id] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update measurement" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await getMeasurementAndCheckAccess(userId, id, [
      "owner",
      "editor",
    ]);
    if (result.error) return result.error;

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
