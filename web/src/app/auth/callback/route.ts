import { createServerClient } from "@supabase/ssr";
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

  // Successful authentication - redirect to intended destination or dashboard
  const redirectTo = requestUrl.searchParams.get("redirect") || "/dashboard";

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

    // Create response to set cookies on
    const response = NextResponse.redirect(
      new URL(redirectTo, requestUrl.origin),
    );

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data, error: exchangeError } =
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

    // Check if this email is allowed to access any profile
    const userEmail = data?.user?.email;
    if (userEmail) {
      const { data: profileId, error: checkError } = await supabase.rpc(
        "check_email_allowed",
        { p_email: userEmail },
      );

      if (checkError || !profileId) {
        // Email not authorized - sign out and reject
        await supabase.auth.signOut();

        // Clear auth cookies from response
        response.cookies.delete("sb-access-token");
        response.cookies.delete("sb-refresh-token");

        return NextResponse.redirect(
          new URL(
            `/login?error=${encodeURIComponent("unauthorized")}&error_description=${encodeURIComponent("Bu e-posta adresi için erişim izni bulunamadı.")}`,
            requestUrl.origin,
          ),
        );
      }
    }

    return response;
  }

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}
