import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getDbUserId, hasProfileAccess } from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_PROFILE_COOKIE = "viziai_active_profile";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * POST /api/profiles/[id]/select
 * Set the active profile for the current user
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getDbUserId(session);

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to select a profile",
        },
        { status: 401 },
      );
    }

    const { id: profileId } = await params;

    if (!profileId) {
      return NextResponse.json(
        { error: "Bad Request", message: "Profile ID is required" },
        { status: 400 },
      );
    }

    // Verify user has access to this profile
    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You don't have access to this profile",
        },
        { status: 403 },
      );
    }

    // Set the active profile cookie
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    console.log(`[API] Profile selected: ${profileId} for user ${userId}`);

    return NextResponse.json({ success: true, profileId });
  } catch (error) {
    console.error("[API] POST /api/profiles/[id]/select error:", error);
    return NextResponse.json(
      { error: "Failed to select profile", details: String(error) },
      { status: 500 },
    );
  }
}
