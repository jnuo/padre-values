/**
 * Supabase Server Client
 *
 * Creates Supabase clients for use in server-side code (API routes, Server Components).
 * Provides two modes:
 * 1. Service Role Client: Bypasses RLS, for admin operations
 * 2. User Context Client: Respects RLS, for user-scoped queries
 *
 * Usage:
 *   // For admin operations (bypasses RLS):
 *   import { createServiceClient } from '@/lib/supabase-server'
 *   const supabase = createServiceClient()
 *
 *   // For user-scoped operations (respects RLS):
 *   import { createServerClient } from '@/lib/supabase-server'
 *   const supabase = createServerClient()
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client with service role key.
 * This client BYPASSES Row Level Security (RLS).
 * Use for server-side admin operations only.
 *
 * @returns SupabaseClient instance with service role privileges
 * @throws Error if environment variables are not configured
 */
export function createServiceClient(): SupabaseClient {
  if (serviceClient) {
    return serviceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Get this from Supabase Dashboard → Project Settings → API → Project URL",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY environment variable. " +
        "Get this from Supabase Dashboard → Project Settings → API → service_role key. " +
        "WARNING: Never expose this key in client-side code!",
    );
  }

  serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      // Service role doesn't need to persist session
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serviceClient;
}

/**
 * Creates a Supabase client with anon key for server-side use.
 * This client RESPECTS Row Level Security (RLS).
 * Use when you need to make queries in the context of an authenticated user.
 *
 * Note: To use this with a user's session, you'll need to set the auth header
 * from cookies or the Authorization header.
 *
 * @returns SupabaseClient instance with anon privileges
 * @throws Error if environment variables are not configured
 */
export function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL environment variable. " +
        "Get this from Supabase Dashboard → Project Settings → API → Project URL",
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. " +
        "Get this from Supabase Dashboard → Project Settings → API → anon/public key",
    );
  }

  // Create a new client each time (not singleton) because each request
  // may have a different user context
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
