import { NextResponse } from "next/server";
import { requireProfileOwner } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/profiles/[id]/access/invites/[inviteId]
 * Revoke a pending invite (owner only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  try {
    const { id: profileId, inviteId } = await params;
    const userId = await requireProfileOwner(profileId);
    if (!userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await sql`
      UPDATE profile_invites
      SET status = 'revoked'
      WHERE id = ${inviteId}
      AND profile_id = ${profileId}
      AND status = 'pending'
      RETURNING id, email
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Davet bulunamadı veya zaten işlenmiş" },
        { status: 404 },
      );
    }

    // Also remove from profile_allowed_emails if no other active invite exists
    const email = result[0].email;
    const otherInvites = await sql`
      SELECT id FROM profile_invites
      WHERE profile_id = ${profileId}
      AND LOWER(email) = LOWER(${email})
      AND status = 'pending'
      AND id != ${inviteId}
    `;

    // Only remove from allowlist if no other pending invites and user hasn't claimed access
    if (otherInvites.length === 0) {
      const hasAccess = await sql`
        SELECT ua.id FROM user_access ua
        JOIN users u ON u.id = ua.user_id_new
        WHERE ua.profile_id = ${profileId}
        AND LOWER(u.email) = LOWER(${email})
      `;

      if (hasAccess.length === 0) {
        await sql`
          DELETE FROM profile_allowed_emails
          WHERE profile_id = ${profileId} AND LOWER(email) = LOWER(${email})
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[API] DELETE /api/profiles/[id]/access/invites/[inviteId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Davet iptal edilemedi" },
      { status: 500 },
    );
  }
}
