import { NextResponse } from "next/server";
import { requireProfileOwner } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/profiles/[id]/access/[userId]
 * Change a user's access level (owner only, can't change self, can't set owner)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const { id: profileId, userId: targetUserId } = await params;
    const currentUserId = await requireProfileOwner(profileId);
    if (!currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can't change own access level
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: "Kendi erişim seviyenizi değiştiremezsiniz" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { accessLevel: newLevel } = body;

    if (!newLevel || !["viewer", "editor"].includes(newLevel)) {
      return NextResponse.json(
        { error: "Erişim seviyesi 'viewer' veya 'editor' olmalı" },
        { status: 400 },
      );
    }

    const result = await sql`
      UPDATE user_access
      SET access_level = ${newLevel}
      WHERE user_id_new = ${targetUserId} AND profile_id = ${profileId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Kullanıcı erişimi bulunamadı" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] PUT /api/profiles/[id]/access/[userId] error:", error);
    return NextResponse.json(
      { error: "Erişim seviyesi güncellenemedi" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/profiles/[id]/access/[userId]
 * Remove a user's access (owner only, can't remove self)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const { id: profileId, userId: targetUserId } = await params;
    const currentUserId = await requireProfileOwner(profileId);
    if (!currentUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Can't remove own access
    if (targetUserId === currentUserId) {
      return NextResponse.json(
        { error: "Kendi erişiminizi kaldıramazsınız" },
        { status: 400 },
      );
    }

    // Remove user_access
    const result = await sql`
      DELETE FROM user_access
      WHERE user_id_new = ${targetUserId} AND profile_id = ${profileId}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Kullanıcı erişimi bulunamadı" },
        { status: 404 },
      );
    }

    // Also remove from profile_allowed_emails
    const targetUser = await sql`
      SELECT email FROM users WHERE id = ${targetUserId}
    `;
    if (targetUser.length > 0) {
      await sql`
        DELETE FROM profile_allowed_emails
        WHERE profile_id = ${profileId} AND LOWER(email) = LOWER(${targetUser[0].email})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[API] DELETE /api/profiles/[id]/access/[userId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Erişim kaldırılamadı" },
      { status: 500 },
    );
  }
}
