import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth, hasProfileAccess } from "@/lib/auth";
import { reportError } from "@/lib/error-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    const hasAccess = await hasProfileAccess(userId, profileId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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

    const reportIds = reports.map((r) => r.id);

    const metricPrefs = await sql`
      SELECT name, display_order
      FROM metric_preferences
      WHERE profile_id = ${profileId}
      ORDER BY display_order ASC, name ASC
    `;

    const displayOrderMap = new Map<string, number>();
    for (const pref of metricPrefs || []) {
      displayOrderMap.set(pref.name, pref.display_order);
    }

    const reportDateMap = new Map<string, string>();
    for (const report of reports) {
      reportDateMap.set(report.id, report.sample_date);
    }

    const metricsData = await sql`
      SELECT report_id, name, value, unit, ref_low, ref_high
      FROM metrics
      WHERE report_id = ANY(${reportIds})
    `;

    // Build latest ref ranges per metric name.
    // Sort by report date ascending so that overwriting gives us the most recent ref.
    const metricsByDateAsc = [...(metricsData || [])].sort((a, b) => {
      const dateA = reportDateMap.get(a.report_id) || "";
      const dateB = reportDateMap.get(b.report_id) || "";
      return dateA.localeCompare(dateB);
    });

    const latestRefsMap = new Map<
      string,
      { unit: string; ref_low: number | null; ref_high: number | null }
    >();
    for (const m of metricsByDateAsc) {
      if (m.ref_low != null || m.ref_high != null) {
        latestRefsMap.set(m.name, {
          unit: m.unit || "",
          ref_low: m.ref_low,
          ref_high: m.ref_high,
        });
      }
    }

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

      values.push({
        metric_id: m.name,
        date,
        value: Number(m.value),
      });

      if (!metricsMap.has(m.name)) {
        const latestRef = latestRefsMap.get(m.name);
        metricsMap.set(m.name, {
          unit: latestRef?.unit || m.unit || "",
          ref_min: latestRef?.ref_low ?? null,
          ref_max: latestRef?.ref_high ?? null,
          display_order: displayOrderMap.get(m.name) ?? 99999,
        });
      }
    }

    values.sort((a, b) => a.date.localeCompare(b.date));

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
    reportError(error, { op: "api.metrics.GET" });
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 },
    );
  }
}
