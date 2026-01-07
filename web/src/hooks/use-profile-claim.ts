"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

type ClaimResult = {
  claimed: boolean;
  message: string;
  profile_id?: string;
  profile_name?: string;
};

type ProfileError = {
  type: "auth" | "profile_name" | "claim";
  message: string;
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
 *   const { isAuthenticated, claimResult, loading, error } = useProfileClaim();
 */
export function useProfileClaim() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ProfileError | null>(null);

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
          // Get display name from Google OAuth metadata
          setUserName(
            user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              null,
          );

          // Fetch the profile display_name using RPC (bypasses RLS recursion)
          const { data: profileDisplayName, error: profileError } =
            await supabase.rpc("get_my_profile_name");

          if (profileError) {
            console.error("Failed to fetch profile name:", profileError);
            if (mounted) {
              setError({
                type: "profile_name",
                message: "Profil adı yüklenemedi.",
              });
            }
          } else if (profileDisplayName) {
            setProfileName(profileDisplayName);
          }

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
                    // Set profile name from claim result
                    setProfileName(result.profile_name || null);
                  }
                }
              } else {
                console.error("Profile claim failed:", response.status);
                if (mounted) {
                  setError({
                    type: "claim",
                    message: "Profil bağlama işlemi başarısız oldu.",
                  });
                }
              }
            } catch (err) {
              console.error("Profile claim error:", err);
              if (mounted) {
                setError({
                  type: "claim",
                  message: "Profil bağlama işlemi başarısız oldu.",
                });
              }
            }
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (mounted) {
          setIsAuthenticated(false);
          setError({
            type: "auth",
            message: "Oturum doğrulaması başarısız oldu.",
          });
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

  return {
    isAuthenticated,
    userEmail,
    userName,
    profileName,
    claimResult,
    loading,
    error,
  };
}
