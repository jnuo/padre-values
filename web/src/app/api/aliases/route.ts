import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      SELECT alias, canonical_name FROM metric_aliases
    `;

    const aliases = Object.fromEntries(
      rows.map((row) => [row.alias, row.canonical_name]),
    );
    return NextResponse.json({ aliases });
  } catch (error) {
    console.error("Failed to fetch aliases:", error);
    return NextResponse.json({ aliases: {} });
  }
}
