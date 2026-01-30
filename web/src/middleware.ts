import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Next.js Middleware for Authentication (NextAuth.js)
 *
 * This middleware runs on every request and:
 * 1. Checks if the user is authenticated using NextAuth session
 * 2. Redirects unauthenticated users from protected routes to /login
 * 3. Redirects authenticated users from /login to /dashboard
 * 4. Redirects new users (no profiles) to /onboarding
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Get the NextAuth token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;

  // Protected routes that require authentication
  const protectedRoutes = ["/dashboard", "/upload", "/onboarding"];
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Auth routes (login page) - redirect to dashboard if already logged in
  const authRoutes = ["/login"];
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Protected API routes
  const protectedApiRoutes: string[] = [
    "/api/metrics",
    "/api/metric-order",
    "/api/profiles",
    "/api/upload",
    "/api/onboarding",
  ];

  // Internal worker routes that bypass auth (called server-to-server)
  // Matches: /api/upload/[id]/extract/worker
  const isInternalWorkerRoute = pathname.endsWith("/extract/worker");
  const isProtectedApiRoute = protectedApiRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Onboarding-related paths that should not trigger the onboarding check
  const onboardingPaths = ["/onboarding", "/api/profiles", "/api/onboarding"];
  const isOnboardingPath = onboardingPaths.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
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

  // Return 401 for protected API routes if not authenticated
  // Skip auth check for internal worker routes
  if (isProtectedApiRoute && !isAuthenticated && !isInternalWorkerRoute) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  // For authenticated users on protected routes (except onboarding-related),
  // check if they need onboarding by looking at a cookie
  // Note: We can't make DB calls in middleware, so we use a cookie set by the client
  if (isAuthenticated && isProtectedRoute && !isOnboardingPath) {
    const needsOnboarding = request.cookies.get("viziai_needs_onboarding");
    if (needsOnboarding?.value === "true") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     * - api/auth (NextAuth routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/auth).*)",
  ],
};
