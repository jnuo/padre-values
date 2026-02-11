import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/invite/[token]
 * Public endpoint — validate token and return invite details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const result = await sql`
      SELECT
        pi.email,
        pi.access_level,
        pi.status,
        pi.expires_at,
        p.display_name as profile_name
      FROM profile_invites pi
      JOIN profiles p ON p.id = pi.profile_id
      WHERE pi.token = ${token}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Davet bulunamadı", status: "not_found" },
        { status: 404 },
      );
    }

    const invite = result[0];

    if (invite.status === "revoked") {
      return NextResponse.json({
        status: "revoked",
        profileName: invite.profile_name,
      });
    }

    if (invite.status === "claimed") {
      return NextResponse.json({
        status: "claimed",
        profileName: invite.profile_name,
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({
        status: "expired",
        profileName: invite.profile_name,
      });
    }

    return NextResponse.json({
      status: "pending",
      email: invite.email,
      accessLevel: invite.access_level,
      profileName: invite.profile_name,
      expiresAt: invite.expires_at,
    });
  } catch (error) {
    console.error("[API] GET /api/invite/[token] error:", error);
    return NextResponse.json(
      { error: "Davet bilgileri alınamadı" },
      { status: 500 },
    );
  }
}
