"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Profile {
  id: string;
  display_name: string;
  access_level: string;
  report_count?: number;
}

const ACTIVE_PROFILE_COOKIE = "viziai_active_profile";
const NEEDS_ONBOARDING_COOKIE = "viziai_needs_onboarding";

/**
 * Hook to manage the active profile for multi-profile support
 *
 * This hook:
 * 1. Fetches the user's accessible profiles
 * 2. Determines the active profile (from cookie or first available)
 * 3. Provides a method to switch profiles
 * 4. Sets onboarding cookie if no profiles exist
 *
 * Usage:
 *   const { activeProfile, profiles, loading, switchProfile } = useActiveProfile();
 */
export function useActiveProfile() {
  const { status } = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  // Fetch profiles and determine active one
  useEffect(() => {
    // Wait for session to finish loading
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchProfiles() {
      try {
        const response = await fetch("/api/profiles");

        // Handle auth errors gracefully - user might need to re-login
        if (response.status === 401) {
          console.log(
            "[useActiveProfile] Not authenticated, skipping profile fetch",
          );
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch profiles");
        }

        const data = await response.json();
        const fetchedProfiles = data.profiles || [];

        if (!mounted) return;

        setProfiles(fetchedProfiles);

        if (fetchedProfiles.length === 0) {
          // Set onboarding cookie for middleware redirect
          document.cookie = `${NEEDS_ONBOARDING_COOKIE}=true; path=/; max-age=${60 * 60 * 24}`; // 24 hours
          setActiveProfileId(null);
        } else {
          // Clear onboarding cookie
          document.cookie = `${NEEDS_ONBOARDING_COOKIE}=; path=/; max-age=0`;

          // Check for active profile in cookie
          const cookies = document.cookie.split(";");
          const activeProfileCookie = cookies.find((c) =>
            c.trim().startsWith(`${ACTIVE_PROFILE_COOKIE}=`),
          );
          const cookieProfileId = activeProfileCookie?.split("=")[1]?.trim();

          // Verify the cookie profile ID is still accessible
          const validProfileId =
            cookieProfileId &&
            fetchedProfiles.some((p: Profile) => p.id === cookieProfileId)
              ? cookieProfileId
              : fetchedProfiles[0].id;

          setActiveProfileId(validProfileId);

          // If no cookie or invalid cookie, set to first profile
          if (!cookieProfileId || cookieProfileId !== validProfileId) {
            await selectProfile(validProfileId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch profiles:", err);
        if (mounted) {
          setError("Profiller yüklenemedi");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchProfiles();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isLoading]);

  // Select a profile via API
  const selectProfile = async (profileId: string) => {
    try {
      const response = await fetch(`/api/profiles/${profileId}/select`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to select profile");
      }

      return true;
    } catch (err) {
      console.error("Failed to select profile:", err);
      return false;
    }
  };

  // Switch to a different profile
  const switchProfile = useCallback(
    async (profileId: string) => {
      if (profileId === activeProfileId) return true;

      const success = await selectProfile(profileId);
      if (success) {
        setActiveProfileId(profileId);
      }
      return success;
    },
    [activeProfileId],
  );

  // Get the active profile object
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  // Check if user needs onboarding
  const needsOnboarding = profiles.length === 0 && !loading;

  return {
    activeProfile,
    activeProfileId,
    profiles,
    loading,
    error,
    needsOnboarding,
    switchProfile,
    refetchProfiles: async () => {
      setLoading(true);
      // Re-trigger effect by setting profiles to empty
      setProfiles([]);
    },
  };
}
