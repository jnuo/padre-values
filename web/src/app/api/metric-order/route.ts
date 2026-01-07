import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * GET /api/metric-order?profileName=X
 * Returns array of metric names in display_order
 */
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
      return NextResponse.json({ order: [] });
    }

    const profileId = profiles[0].id;

    // Get metric definitions ordered by display_order
    const { data: definitions, error: defError } = await supabase
      .from("metric_definitions")
      .select("name, display_order")
      .eq("profile_id", profileId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (defError) {
      console.error("Metric definitions query error:", defError);
      return NextResponse.json(
        { error: "Failed to fetch metric order" },
        { status: 500 },
      );
    }

    const order = (definitions || []).map((d) => d.name);

    return NextResponse.json({ order });
  } catch (error) {
    console.error("/api/metric-order GET error", error);
    return NextResponse.json(
      { error: "Failed to fetch metric order" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/metric-order
 * Body: { profileName?: string, order: string[] }
 * Updates display_order in metric_definitions
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const profileName = body.profileName || DEFAULT_PROFILE_NAME;
    const order: string[] = body.order;

    if (!Array.isArray(order)) {
      return NextResponse.json(
        { error: "order must be an array of metric names" },
        { status: 400 },
      );
    }

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
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profileId = profiles[0].id;

    // Update display_order for each metric
    // We need to update each metric definition with its new order
    const updates = order.map((name, index) => ({
      profile_id: profileId,
      name,
      display_order: index,
    }));

    // Use upsert to update display_order for existing metrics
    // This will update display_order for metrics that exist in metric_definitions
    const { error: updateError } = await supabase
      .from("metric_definitions")
      .upsert(updates, {
        onConflict: "profile_id,name",
        ignoreDuplicates: false,
      });

    if (updateError) {
      console.error("Update metric order error:", updateError);
      return NextResponse.json(
        { error: "Failed to update metric order" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, updated: order.length });
  } catch (error) {
    console.error("/api/metric-order PUT error", error);
    return NextResponse.json(
      { error: "Failed to update metric order" },
      { status: 500 },
    );
  }
}
