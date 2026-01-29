import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile-name
 *
 * Returns the display name of the profile associated with the authenticated user's email.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Find profile via allowed emails
    const result = await sql`
      SELECT p.display_name
      FROM profiles p
      JOIN profile_allowed_emails pae ON p.id = pae.profile_id
      WHERE pae.email = ${userEmail}
      LIMIT 1
    `;

    if (result && result.length > 0) {
      return NextResponse.json({ profileName: result[0].display_name });
    }

    return NextResponse.json({ profileName: null });
  } catch (error) {
    console.error("/api/profile-name error", error);
    return NextResponse.json(
      { error: "Failed to fetch profile name" },
      { status: 500 },
    );
  }
}
