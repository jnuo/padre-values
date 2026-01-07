"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

type ClaimResult = {
  claimed: boolean;
  message: string;
  profile_id?: string;
  profile_name?: string;
};

/**
 * Hook to automatically claim profiles when a user first logs in
 *
 * This hook:
 * 1. Checks if the user is authenticated via Supabase
 * 2. If yes, calls the claim-profile API to link any matching profiles
 * 3. Shows a toast notification if a profile was claimed
 *
 * Usage:
 *   const { isAuthenticated, claimResult, loading } = useProfileClaim();
 */
export function useProfileClaim() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuthAndClaim() {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (user) {
          setIsAuthenticated(true);
          setUserEmail(user.email || null);

          // Check if we've already tried to claim for this user
          const claimAttemptKey = `profile_claim_attempted_${user.id}`;
          const hasAttempted = localStorage.getItem(claimAttemptKey);

          if (!hasAttempted) {
            // Try to claim profile
            try {
              const response = await fetch("/api/claim-profile", {
                method: "POST",
              });

              if (response.ok) {
                const result = await response.json();
                if (mounted) {
                  setClaimResult(result);

                  // Mark that we've attempted claim for this user
                  localStorage.setItem(claimAttemptKey, "true");

                  if (result.claimed) {
                    console.log(
                      "[PROFILE_CLAIM] Successfully claimed profile:",
                      result.profile_name,
                    );
                  } else {
                    console.log(
                      "[PROFILE_CLAIM] No profile to claim:",
                      result.message,
                    );
                  }
                }
              }
            } catch (claimError) {
              console.warn(
                "[PROFILE_CLAIM] Failed to claim profile:",
                claimError,
              );
            }
          } else {
            console.log(
              "[PROFILE_CLAIM] Already attempted claim for this user",
            );
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn("[PROFILE_CLAIM] Auth check failed:", err);
        if (mounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkAuthAndClaim();

    return () => {
      mounted = false;
    };
  }, []);

  return { isAuthenticated, userEmail, claimResult, loading };
}
