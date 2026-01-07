import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js Middleware for Authentication
 *
 * This middleware runs on every request and:
 * 1. Checks if the user is authenticated using Supabase session
 * 2. Redirects unauthenticated users from protected routes to /login
 * 3. Redirects authenticated users from /login to /dashboard
 * 4. Refreshes the session if it's about to expire
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow all requests (development mode)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[Middleware] Supabase not configured, skipping auth check. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;
  const pathname = request.nextUrl.pathname;

  // Check for demo mode cookie
  const isDemoMode = request.cookies.get("demo_mode")?.value === "true";

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard"];
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Auth routes (login page) - redirect to dashboard if already logged in
  const authRoutes = ["/login"];
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Protected API routes
  const protectedApiRoutes = ["/api/metrics", "/api/metric-order"];
  const isProtectedApiRoute = protectedApiRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Redirect unauthenticated users from protected routes to login (unless demo mode)
  if (isProtectedRoute && !isAuthenticated && !isDemoMode) {
    const redirectUrl = new URL("/login", request.url);
    // Save the intended destination for post-login redirect
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from login page to dashboard
  if (isAuthRoute && isAuthenticated) {
    // Check if there's a redirect param to honor
    const redirectTo = request.nextUrl.searchParams.get("redirect");
    const destination = redirectTo || "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Return 401 for protected API routes if not authenticated (unless demo mode)
  if (isProtectedApiRoute && !isAuthenticated && !isDemoMode) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - auth/callback (OAuth callback route)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback).*)",
  ],
};
