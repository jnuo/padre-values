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
const DEFAULT_PROFILE_NAME = "Father (Migrated)";

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

    // Get all metrics for these reports
    const { data: metricsData, error: metricsError } = await supabase
      .from("metrics")
      .select("report_id, name, value, unit, ref_low, ref_high")
      .in("report_id", reportIds);

    if (metricsError) {
      console.error("Metrics query error:", metricsError);
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 },
      );
    }

    // Build report_id -> date map
    const reportDateMap = new Map<string, string>();
    for (const report of reports) {
      reportDateMap.set(report.id, report.sample_date);
    }

    // Build unique metrics list with reference values
    const metricsMap = new Map<
      string,
      { unit: string; ref_min: number | null; ref_max: number | null }
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

      // Track unique metrics with their reference values
      if (!metricsMap.has(m.name)) {
        metricsMap.set(m.name, {
          unit: m.unit || "",
          ref_min: m.ref_low,
          ref_max: m.ref_high,
        });
      }
    }

    // Build metrics array
    const metrics: Metric[] = Array.from(metricsMap.entries()).map(
      ([name, ref]) => ({
        id: name,
        name,
        unit: ref.unit,
        ref_min: ref.ref_min,
        ref_max: ref.ref_max,
      }),
    );

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
