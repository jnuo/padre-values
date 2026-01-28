"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

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
 * 1. Checks if the user is authenticated via NextAuth
 * 2. If yes, calls the claim-profile API to link any matching profiles
 * 3. Shows a toast notification if a profile was claimed
 *
 * Usage:
 *   const { isAuthenticated, claimResult, loading, error } = useProfileClaim();
 */
export function useProfileClaim() {
  const { data: session, status } = useSession();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<ProfileError | null>(null);

  const isAuthenticated = status === "authenticated";
  const loading = status === "loading";
  const userEmail = session?.user?.email || null;
  const userName = session?.user?.name || userEmail?.split("@")[0] || null;

  useEffect(() => {
    if (!isAuthenticated || !session?.user?.email) return;

    let mounted = true;

    async function fetchProfileAndClaim() {
      try {
        // Fetch profile name via API
        const profileResponse = await fetch("/api/profile-name");
        if (profileResponse.ok) {
          const data = await profileResponse.json();
          if (mounted && data.profileName) {
            setProfileName(data.profileName);
          }
        }

        // Check if we've already tried to claim for this user
        const claimAttemptKey = `profile_claim_attempted_${session?.user?.email}`;
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
      } catch (err) {
        console.error("Profile fetch failed:", err);
        if (mounted) {
          setError({
            type: "profile_name",
            message: "Profil adı yüklenemedi.",
          });
        }
      }
    }

    fetchProfileAndClaim();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, session?.user?.email]);

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
