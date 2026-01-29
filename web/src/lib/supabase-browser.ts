/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for use in browser/client-side code.
 * Uses @supabase/ssr to properly handle PKCE code verifier in cookies.
 *
 * Usage:
 *   import { createBrowserClient } from '@/lib/supabase-browser'
 *   const supabase = createBrowserClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for browser-side operations.
 * Uses singleton pattern to avoid creating multiple clients.
 * Uses @supabase/ssr to store PKCE code verifier in cookies.
 *
 * @returns SupabaseClient instance
 * @throws Error if environment variables are not configured
 */
export function createBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

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

  // Use @supabase/ssr's createBrowserClient which handles PKCE code verifier in cookies
  browserClient = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);

  return browserClient;
}
