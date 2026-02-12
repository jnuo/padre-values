import { NextResponse } from "next/server";
import {
  requireAuth,
  requireProfileOwner,
  getProfileAccessLevel,
} from "@/lib/auth";
import { sql } from "@/lib/db";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profiles/[id]/access
 * List members for a profile (any member can view, owner gets full details)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: profileId } = await params;
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessLevel = await getProfileAccessLevel(userId, profileId);
    if (!accessLevel) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isOwner = accessLevel === "owner";

    const members = await sql`
      SELECT
        u.id as user_id,
        u.email,
        u.name,
        u.avatar_url,
        ua.access_level,
        ua.granted_at
      FROM user_access ua
      JOIN users u ON u.id = ua.user_id_new
      WHERE ua.profile_id = ${profileId}
      ORDER BY
        CASE ua.access_level WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        ua.granted_at ASC
    `;

    // Non-owners only see the members list
    if (!isOwner) {
      return NextResponse.json({
        members,
        invites: [],
        allowedEmails: [],
        accessLevel,
      });
    }

    // Owner gets full details: pending invites + allowed emails
    const invites = await sql`
      SELECT
        id,
        email,
        access_level,
        token,
        status,
        created_at,
        expires_at
      FROM profile_invites
      WHERE profile_id = ${profileId}
      AND status = 'pending'
      AND expires_at > NOW()
      ORDER BY created_at DESC
    `;

    const allowedEmails = await sql`
      SELECT pae.id, pae.email, pae.created_at
      FROM profile_allowed_emails pae
      WHERE pae.profile_id = ${profileId}
      AND pae.claimed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM user_access ua
        JOIN users u ON u.id = ua.user_id_new
        WHERE ua.profile_id = pae.profile_id
        AND LOWER(u.email) = LOWER(pae.email)
      )
      AND NOT EXISTS (
        SELECT 1 FROM profile_invites pi
        WHERE pi.profile_id = pae.profile_id
        AND LOWER(pi.email) = LOWER(pae.email)
        AND pi.status = 'pending'
        AND pi.expires_at > NOW()
      )
      ORDER BY pae.created_at ASC
    `;

    return NextResponse.json({
      members,
      invites,
      allowedEmails,
      accessLevel,
    });
  } catch (error) {
    console.error("[API] GET /api/profiles/[id]/access error:", error);
    return NextResponse.json(
      { error: "Failed to fetch access list" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/profiles/[id]/access
 * Create an invite (owner only)
 * Body: { email: string, accessLevel: 'viewer' | 'editor' }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: profileId } = await params;
    const userId = await requireProfileOwner(profileId);
    if (!userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, accessLevel: inviteLevel } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "E-posta adresi gerekli" },
        { status: 400 },
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Geçersiz e-posta adresi" },
        { status: 400 },
      );
    }

    if (!inviteLevel || !["viewer", "editor"].includes(inviteLevel)) {
      return NextResponse.json(
        { error: "Erişim seviyesi 'viewer' veya 'editor' olmalı" },
        { status: 400 },
      );
    }

    // Check if user already has access (also catches self-invite)
    const existingAccess = await sql`
      SELECT ua.id FROM user_access ua
      JOIN users u ON u.id = ua.user_id_new
      WHERE ua.profile_id = ${profileId}
      AND LOWER(u.email) = ${trimmedEmail}
    `;

    if (existingAccess.length > 0) {
      return NextResponse.json(
        { error: "Bu kullanıcının zaten erişimi var" },
        { status: 409 },
      );
    }

    // If user is already registered, grant access directly (no invite URL needed)
    const existingUser = await sql`
      SELECT id, name FROM users WHERE LOWER(email) = ${trimmedEmail}
    `;

    if (existingUser.length > 0) {
      await sql`
        INSERT INTO user_access (user_id_new, profile_id, access_level, granted_by)
        VALUES (${existingUser[0].id}, ${profileId}, ${inviteLevel}, ${userId})
        ON CONFLICT (user_id_new, profile_id) DO NOTHING
      `;

      return NextResponse.json(
        {
          directAccess: true,
          email: trimmedEmail,
          name: existingUser[0].name,
          accessLevel: inviteLevel,
        },
        { status: 201 },
      );
    }

    // User not registered — create invite with token
    const existingInvite = await sql`
      SELECT id FROM profile_invites
      WHERE profile_id = ${profileId}
      AND LOWER(email) = ${trimmedEmail}
      AND status = 'pending'
      AND expires_at > NOW()
    `;

    if (existingInvite.length > 0) {
      return NextResponse.json(
        { error: "Bu e-posta için bekleyen bir davet zaten var" },
        { status: 409 },
      );
    }

    const token = randomBytes(32).toString("hex");

    await sql`
      INSERT INTO profile_allowed_emails (profile_id, email)
      VALUES (${profileId}, ${trimmedEmail})
      ON CONFLICT (email, profile_id) DO NOTHING
    `;

    const invite = await sql`
      INSERT INTO profile_invites (profile_id, email, access_level, token, invited_by)
      VALUES (${profileId}, ${trimmedEmail}, ${inviteLevel}, ${token}, ${userId})
      RETURNING id, token, created_at, expires_at
    `;

    const host = request.headers.get("host") || "localhost:3000";
    const protocol =
      host.startsWith("localhost") || /^\d+\.\d+\.\d+\.\d+/.test(host)
        ? "http"
        : "https";
    const inviteUrl = `${protocol}://${host}/invite/${token}`;

    return NextResponse.json(
      {
        invite: {
          id: invite[0].id,
          email: trimmedEmail,
          accessLevel: inviteLevel,
          inviteUrl,
          createdAt: invite[0].created_at,
          expiresAt: invite[0].expires_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API] POST /api/profiles/[id]/access error:", error);
    return NextResponse.json(
      { error: "Davet oluşturulamadı" },
      { status: 500 },
    );
  }
}
