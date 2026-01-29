import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Next.js Middleware for Authentication (NextAuth.js)
 *
 * This middleware runs on every request and:
 * 1. Checks if the user is authenticated using NextAuth session
 * 2. Redirects unauthenticated users from protected routes to /login
 * 3. Redirects authenticated users from /login to /dashboard
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
  const protectedApiRoutes: string[] = ["/api/metrics", "/api/metric-order"];
  const isProtectedApiRoute = protectedApiRoutes.some(
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
  if (isProtectedApiRoute && !isAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 },
    );
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
