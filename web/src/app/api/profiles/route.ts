import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profiles
 * List all profiles the current user has access to
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getDbUserId(session);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view profiles" },
        { status: 401 },
      );
    }

    const profiles = await sql`
      SELECT
        p.id,
        p.display_name,
        ua.access_level,
        p.created_at,
        (SELECT COUNT(*) FROM reports r WHERE r.profile_id = p.id) as report_count
      FROM profiles p
      JOIN user_access ua ON ua.profile_id = p.id
      WHERE ua.user_id = ${userId}
      ORDER BY p.display_name ASC
    `;

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("[API] GET /api/profiles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profiles", details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/profiles
 * Create a new profile for the current user
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getDbUserId(session);

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to create a profile",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { displayName } = body;

    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json(
        { error: "Bad Request", message: "displayName is required" },
        { status: 400 },
      );
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "displayName must be 1-100 characters",
        },
        { status: 400 },
      );
    }

    // Create the profile
    const profileResult = await sql`
      INSERT INTO profiles (display_name, owner_user_id)
      VALUES (${trimmedName}, ${userId})
      RETURNING id, display_name, created_at
    `;

    const profile = profileResult[0];
    if (!profile) {
      throw new Error("Failed to create profile");
    }

    // Create user_access entry with owner level
    await sql`
      INSERT INTO user_access (user_id, profile_id, access_level, granted_by)
      VALUES (${userId}, ${profile.id}, 'owner', ${userId})
    `;

    console.log(`[API] Profile created: ${profile.id} for user ${userId}`);

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          display_name: profile.display_name,
          access_level: "owner",
          created_at: profile.created_at,
          report_count: 0,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API] POST /api/profiles error:", error);
    return NextResponse.json(
      { error: "Failed to create profile", details: String(error) },
      { status: 500 },
    );
  }
}
