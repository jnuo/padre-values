import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Claim Profile API
 *
 * POST /api/claim-profile
 *
 * After a user logs in for the first time, this endpoint checks if there's
 * an existing profile with their email in profile_allowed_emails and
 * associates it with their account via user_access.
 *
 * This enables existing data (migrated from Google Sheets) to be linked to
 * the correct user when they first authenticate with Google OAuth.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Check if user already has access to any profile
    const existingAccess = await sql`
      SELECT ua.profile_id, p.display_name
      FROM user_access ua
      JOIN profiles p ON ua.profile_id = p.id
      WHERE ua.user_email = ${userEmail}
      LIMIT 1
    `;

    if (existingAccess && existingAccess.length > 0) {
      return NextResponse.json({
        claimed: false,
        message: "User already has profile access",
        profile_id: existingAccess[0].profile_id,
        profile_name: existingAccess[0].display_name,
      });
    }

    // Find profile by allowed email
    const allowedProfile = await sql`
      SELECT pae.profile_id, p.display_name
      FROM profile_allowed_emails pae
      JOIN profiles p ON pae.profile_id = p.id
      WHERE pae.email = ${userEmail}
      LIMIT 1
    `;

    if (!allowedProfile || allowedProfile.length === 0) {
      return NextResponse.json({
        claimed: false,
        message: "No unclaimed profile found for your email",
      });
    }

    const profileId = allowedProfile[0].profile_id;
    const profileName = allowedProfile[0].display_name;

    // Create user_access entry to claim the profile
    await sql`
      INSERT INTO user_access (profile_id, user_email, access_level)
      VALUES (${profileId}, ${userEmail}, 'owner')
      ON CONFLICT (profile_id, user_email) DO NOTHING
    `;

    return NextResponse.json({
      claimed: true,
      message: `Successfully claimed profile: ${profileName}`,
      profile_id: profileId,
      profile_name: profileName,
    });
  } catch (error) {
    console.error("/api/claim-profile error", error);
    return NextResponse.json(
      { error: "Failed to claim profile", details: String(error) },
      { status: 500 },
    );
  }
}
