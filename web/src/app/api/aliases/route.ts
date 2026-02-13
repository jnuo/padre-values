import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { reportError } from "@/lib/error-reporting";

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
    reportError(error, { op: "api.aliases.GET" });
    return NextResponse.json({ aliases: {} });
  }
}
