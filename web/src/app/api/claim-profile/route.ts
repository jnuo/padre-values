import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Claim Profile API
 *
 * POST /api/claim-profile
 *
 * After a user logs in for the first time, this endpoint checks if there's
 * an existing profile with their email and associates it with their account.
 *
 * This enables existing data (migrated from Google Sheets) to be linked to
 * the correct user when they first authenticate with Google OAuth.
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 },
    );
  }

  // Create Supabase client with user's session
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Ignore errors when setting cookies in Server Components
        }
      },
    },
  });

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user already has a profile
  const { data: existingAccess } = await supabase
    .from("user_access")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1);

  if (existingAccess && existingAccess.length > 0) {
    return NextResponse.json({
      claimed: false,
      message: "User already has profile access",
      profile_id: existingAccess[0].profile_id,
    });
  }

  // Call the claim function
  const { data: claimResult, error: claimError } = await supabase.rpc(
    "claim_profile_by_email",
    {
      p_user_id: user.id,
      p_user_email: user.email,
    },
  );

  if (claimError) {
    console.error("Error claiming profile:", claimError);
    return NextResponse.json(
      { error: "Failed to claim profile", details: claimError.message },
      { status: 500 },
    );
  }

  if (claimResult && claimResult.length > 0) {
    const claimed = claimResult[0];
    return NextResponse.json({
      claimed: true,
      message: `Successfully claimed profile: ${claimed.profile_name}`,
      profile_id: claimed.claimed_profile_id,
      profile_name: claimed.profile_name,
    });
  }

  return NextResponse.json({
    claimed: false,
    message: "No unclaimed profile found for your email",
  });
}
