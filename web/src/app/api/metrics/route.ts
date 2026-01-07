import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types matching the existing sheets.ts format
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

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    );
  }

  return createClient(url, key);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileName = searchParams.get("profileName") || DEFAULT_PROFILE_NAME;

    const supabase = getSupabaseClient();

    // Find the profile
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", profileName);

    if (profileError) {
      console.error("Profile query error:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 },
      );
    }

    if (!profiles || profiles.length === 0) {
      // Return empty data if no profile found
      return NextResponse.json({ metrics: [], values: [] });
    }

    const profileId = profiles[0].id;

    // Get all reports for this profile
    const { data: reports, error: reportsError } = await supabase
      .from("reports")
      .select("id, sample_date")
      .eq("profile_id", profileId)
      .order("sample_date", { ascending: true });

    if (reportsError) {
      console.error("Reports query error:", reportsError);
      return NextResponse.json(
        { error: "Failed to fetch reports" },
        { status: 500 },
      );
    }

    if (!reports || reports.length === 0) {
      return NextResponse.json({ metrics: [], values: [] });
    }

    const reportIds = reports.map((r) => r.id);

    // Fetch metric_definitions for canonical reference values and display order
    const { data: metricDefs, error: defsError } = await supabase
      .from("metric_definitions")
      .select("name, unit, ref_low, ref_high, display_order")
      .eq("profile_id", profileId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (defsError) {
      console.error("Metric definitions query error:", defsError);
      return NextResponse.json(
        { error: "Failed to fetch metric definitions" },
        { status: 500 },
      );
    }

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

    // Paginate through all metrics (Supabase has a 1000 row default limit)
    const allMetricsData: Array<{
      report_id: string;
      name: string;
      value: number;
      unit: string | null;
      ref_low: number | null;
      ref_high: number | null;
    }> = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: metricsPage, error: metricsError } = await supabase
        .from("metrics")
        .select("report_id, name, value, unit, ref_low, ref_high")
        .in("report_id", reportIds)
        .range(offset, offset + pageSize - 1);

      if (metricsError) {
        console.error("Metrics query error:", metricsError);
        return NextResponse.json(
          { error: "Failed to fetch metrics" },
          { status: 500 },
        );
      }

      if (metricsPage && metricsPage.length > 0) {
        allMetricsData.push(...metricsPage);
        offset += pageSize;
        hasMore = metricsPage.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    const metricsData = allMetricsData;

    // Build report_id -> date map
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

      // Add to values array
      values.push({
        metric_id: m.name,
        date,
        value: m.value,
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
    values.sort((a, b) => a.date.localeCompare(b.date));

    // Build metrics array, sorted by display_order
    const metrics: Metric[] = Array.from(metricsMap.entries())
      .sort((a, b) => a[1].display_order - b[1].display_order)
      .map(([name, ref]) => ({
        id: name,
        name,
        unit: ref.unit,
        ref_min: ref.ref_min,
        ref_max: ref.ref_max,
      }));

    const payload: MetricsPayload = { metrics, values };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("/api/metrics error", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics from Supabase" },
      { status: 500 },
    );
  }
}
