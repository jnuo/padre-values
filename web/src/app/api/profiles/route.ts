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

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view profiles" },
        { status: 401 },
      );
    }

    // Get dbId from session, or look up by email if not present (for old sessions)
    let userId = getDbUserId(session);

    if (!userId) {
      // Look up user by email
      const users = await sql`
        SELECT id FROM users WHERE email = ${session.user.email}
      `;

      if (users.length > 0) {
        userId = users[0].id;
      } else {
        // Create user record if it doesn't exist
        const newUser = await sql`
          INSERT INTO users (email, name, avatar_url)
          VALUES (${session.user.email}, ${session.user.name || null}, ${session.user.image || null})
          ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
          RETURNING id
        `;
        userId = newUser[0]?.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Could not identify user" },
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
      WHERE ua.user_id_new = ${userId}
      ORDER BY p.display_name ASC
    `;

    // Clear onboarding cookie if user has profiles (fixes stale cookie redirect issue)
    const response = NextResponse.json({ profiles });
    if (profiles.length > 0) {
      response.cookies.set("viziai_needs_onboarding", "", {
        path: "/",
        maxAge: 0,
      });
    }

    return response;
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

    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to create a profile",
        },
        { status: 401 },
      );
    }

    // Get dbId from session, or look up by email if not present (for old sessions)
    let userId = getDbUserId(session);

    if (!userId) {
      // Look up user by email
      const users = await sql`
        SELECT id FROM users WHERE email = ${session.user.email}
      `;

      if (users.length > 0) {
        userId = users[0].id;
      } else {
        // Create user record if it doesn't exist (same as GET handler)
        const newUser = await sql`
          INSERT INTO users (email, name, avatar_url)
          VALUES (${session.user.email}, ${session.user.name || null}, ${session.user.image || null})
          ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
          RETURNING id
        `;
        userId = newUser[0]?.id;
        console.log(
          `[API] Created user record for ${session.user.email}: ${userId}`,
        );
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Could not identify user",
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

    console.log(`[API] Creating profile "${trimmedName}" for user ${userId}`);

    // Create the profile
    const profileResult = await sql`
      INSERT INTO profiles (display_name, owner_user_id)
      VALUES (${trimmedName}, ${userId})
      RETURNING id, display_name, created_at
    `;

    const profile = profileResult[0];
    if (!profile) {
      console.error(
        `[API] Profile INSERT returned no result for user ${userId}`,
      );
      throw new Error("Failed to create profile - no result returned");
    }

    console.log(
      `[API] Profile created: ${profile.id}, creating user_access...`,
    );

    // Create user_access entry with owner level
    await sql`
      INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
      VALUES (${userId}, ${profile.id}, 'owner', ${userId})
    `;

    console.log(
      `[API] Profile ${profile.id} created successfully for user ${userId}`,
    );

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
      {
        error: "Failed to create profile",
        message:
          "Profil oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
