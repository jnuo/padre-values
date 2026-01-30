import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId, getUserProfiles } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/status
 * Check if user needs to complete onboarding
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getDbUserId(session);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in" },
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
      { error: "Failed to check onboarding status", details: String(error) },
      { status: 500 },
    );
  }
}
