import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/invite/[token]/claim
 * Authenticated endpoint — claim an invite, verify email match
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await params;

    // Get invite details
    const result = await sql`
      SELECT
        pi.id,
        pi.profile_id,
        pi.email,
        pi.access_level,
        pi.status,
        pi.expires_at
      FROM profile_invites pi
      WHERE pi.token = ${token}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Davet bulunamadı" }, { status: 404 });
    }

    const invite = result[0];

    // Check status
    if (invite.status === "revoked") {
      return NextResponse.json(
        { error: "Bu davet iptal edilmiş" },
        { status: 410 },
      );
    }

    if (invite.status === "claimed") {
      return NextResponse.json(
        { error: "Bu davet zaten kullanılmış" },
        { status: 410 },
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Davet süresi dolmuş" },
        { status: 410 },
      );
    }

    // Verify email match
    const userRow = await sql`SELECT email FROM users WHERE id = ${userId}`;
    const userEmail = userRow[0]?.email?.toLowerCase();
    if (userEmail !== invite.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: "E-posta uyuşmuyor",
          inviteEmail: invite.email,
        },
        { status: 403 },
      );
    }

    // Create user_access entry
    await sql`
      INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
      VALUES (${userId}, ${invite.profile_id}, ${invite.access_level}, ${invite.id}::text::uuid)
      ON CONFLICT (user_id_new, profile_id) DO UPDATE
      SET access_level = EXCLUDED.access_level
    `;

    // Mark invite as claimed
    await sql`
      UPDATE profile_invites
      SET status = 'claimed', claimed_at = NOW(), claimed_by_user_id = ${userId}
      WHERE id = ${invite.id}
    `;

    // Mark profile_allowed_emails as claimed
    await sql`
      UPDATE profile_allowed_emails
      SET claimed_at = NOW(), claimed_by_user_id = ${userId}
      WHERE profile_id = ${invite.profile_id}
      AND LOWER(email) = LOWER(${invite.email})
      AND claimed_at IS NULL
    `;

    console.log(
      `[API] Invite claimed: ${invite.email} -> profile ${invite.profile_id} (${invite.access_level})`,
    );

    return NextResponse.json({
      success: true,
      profileId: invite.profile_id,
      accessLevel: invite.access_level,
    });
  } catch (error) {
    console.error("[API] POST /api/invite/[token]/claim error:", error);
    return NextResponse.json(
      { error: "Davet kabul edilemedi" },
      { status: 500 },
    );
  }
}
