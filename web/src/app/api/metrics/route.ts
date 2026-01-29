import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types matching the existing format
type Metric = {
  id: string;
  name: string;
  unit: string;
  ref_min: number | null;
  ref_max: number | null;
};

type MetricValue = {
  metric_id: string;
  date: string; // ISO yyyy-mm-dd
  value: number;
};

type MetricsPayload = {
  metrics: Metric[];
  values: MetricValue[];
};

// Default profile name for migrated data
const DEFAULT_PROFILE_NAME = "Yüksel O.";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileName = searchParams.get("profileName") || DEFAULT_PROFILE_NAME;

    // Find the profile
    const profiles = await sql`
      SELECT id FROM profiles WHERE display_name = ${profileName}
    `;

    if (!profiles || profiles.length === 0) {
      // Return empty data if no profile found
      return NextResponse.json({ metrics: [], values: [] });
    }

    const profileId = profiles[0].id;

    // Get all reports for this profile
    // Cast sample_date to TEXT to avoid timezone conversion issues with JS Date
    const reports = await sql`
      SELECT id, sample_date::TEXT as sample_date
      FROM reports
      WHERE profile_id = ${profileId}
      ORDER BY sample_date ASC
    `;

    if (!reports || reports.length === 0) {
      return NextResponse.json({ metrics: [], values: [] });
    }

    const reportIds = reports.map((r) => (r as { id: string }).id);

    // Fetch metric_definitions for canonical reference values and display order
    const metricDefs = await sql`
      SELECT name, unit, ref_low, ref_high, display_order
      FROM metric_definitions
      WHERE profile_id = ${profileId}
      ORDER BY display_order ASC, name ASC
    `;

    // Build map of canonical metric info from metric_definitions
    const metricDefsMap = new Map<
      string,
      {
        unit: string;
        ref_low: number | null;
        ref_high: number | null;
        display_order: number;
      }
    >();
    for (const def of metricDefs || []) {
      metricDefsMap.set(def.name, {
        unit: def.unit || "",
        ref_low: def.ref_low,
        ref_high: def.ref_high,
        display_order: def.display_order,
      });
    }

    // Fetch all metrics for these reports
    const metricsData = await sql`
      SELECT report_id, name, value, unit, ref_low, ref_high
      FROM metrics
      WHERE report_id = ANY(${reportIds})
    `;

    // Build report_id -> date map (sample_date is cast to TEXT in SQL)
    const reportDateMap = new Map<string, string>();
    for (const report of reports) {
      reportDateMap.set(report.id, report.sample_date);
    }

    // Build unique metrics list - use metric_definitions for refs, fallback to metric row
    const metricsMap = new Map<
      string,
      {
        unit: string;
        ref_min: number | null;
        ref_max: number | null;
        display_order: number;
      }
    >();
    const values: MetricValue[] = [];

    for (const m of metricsData || []) {
      const date = reportDateMap.get(m.report_id);
      if (!date) continue;

      // sample_date is already a string (cast in SQL to avoid timezone issues)
      const dateStr = date;
      values.push({
        metric_id: m.name,
        date: dateStr,
        value: Number(m.value),
      });

      // Track unique metrics - prefer metric_definitions for refs
      if (!metricsMap.has(m.name)) {
        const def = metricDefsMap.get(m.name);
        if (def) {
          // Use canonical values from metric_definitions
          metricsMap.set(m.name, {
            unit: def.unit,
            ref_min: def.ref_low,
            ref_max: def.ref_high,
            display_order: def.display_order,
          });
        } else {
          // Fallback to metric row values if no definition exists
          metricsMap.set(m.name, {
            unit: m.unit || "",
            ref_min: m.ref_low,
            ref_max: m.ref_high,
            display_order: 99999, // Put undefined metrics at the end
          });
        }
      }
    }

    // Sort values by date (ascending) for proper chart rendering
    values.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Build metrics array, sorted by display_order
    const metrics: Metric[] = Array.from(metricsMap.entries())
      .sort((a, b) => a[1].display_order - b[1].display_order)
      .map(([name, ref]) => ({
        id: name,
        name,
        unit: ref.unit,
        ref_min: ref.ref_min != null ? Number(ref.ref_min) : null,
        ref_max: ref.ref_max != null ? Number(ref.ref_max) : null,
      }));

    const payload: MetricsPayload = { metrics, values };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("/api/metrics error", error);
    return NextResponse.json(
      {
        error: "Failed to fetch metrics from database",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
