import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log(
      "NEON_DATABASE_URL:",
      process.env.NEON_DATABASE_URL?.substring(0, 50) + "...",
    );

    const result = await sql`SELECT count(*) as count FROM profiles`;
    console.log("Query result:", result);

    return NextResponse.json({
      success: true,
      profiles_count: result[0]?.count,
      env_set: !!process.env.NEON_DATABASE_URL,
    });
  } catch (error) {
    console.error("Test DB error:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        env_set: !!process.env.NEON_DATABASE_URL,
      },
      { status: 500 },
    );
  }
}
