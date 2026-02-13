import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId, getUserProfiles } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/status
 * Check if user needs to complete onboarding
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in" },
        { status: 401 },
      );
    }

    let userId = getDbUserId(session);
    if (!userId) {
      const users =
        await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${session.user.email})`;
      if (users.length > 0) userId = users[0].id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Could not identify user" },
        { status: 401 },
      );
    }

    // Check if user has any profiles
    const profiles = await getUserProfiles(userId);
    const needsOnboarding = profiles.length === 0;

    return NextResponse.json({
      needsOnboarding,
      profileCount: profiles.length,
    });
  } catch (error) {
    console.error("[API] GET /api/onboarding/status error:", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 },
    );
  }
}
