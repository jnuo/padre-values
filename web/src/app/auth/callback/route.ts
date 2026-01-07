import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth Callback Handler
 *
 * This route handles the callback from Supabase OAuth providers (Google).
 * After successful authentication, the user is redirected to the dashboard.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("OAuth callback error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || "")}`,
        requestUrl.origin,
      ),
    );
  }

  // Exchange the code for a session
  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("configuration_error")}&error_description=${encodeURIComponent("Supabase configuration missing")}`,
          requestUrl.origin,
        ),
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Code exchange error:", exchangeError);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("exchange_error")}&error_description=${encodeURIComponent(exchangeError.message)}`,
          requestUrl.origin,
        ),
      );
    }
  }

  // Successful authentication - redirect to intended destination or dashboard
  const redirectTo = requestUrl.searchParams.get("redirect") || "/dashboard";
  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
