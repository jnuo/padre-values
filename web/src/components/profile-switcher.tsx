"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  display_name: string;
  access_level: string;
  report_count?: number;
}

interface ProfileSwitcherProps {
  currentProfileId?: string;
  currentProfileName?: string;
  className?: string;
}

export function ProfileSwitcher({
  currentProfileId,
  currentProfileName,
  className,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Fetch profiles on mount
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const response = await fetch("/api/profiles");
        if (response.ok) {
          const data = await response.json();
          setProfiles(data.profiles || []);
        }
      } catch (error) {
        console.error("Failed to fetch profiles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfiles();
  }, []);

  const handleSelectProfile = async (profileId: string) => {
    if (profileId === currentProfileId || switching) return;

    setSwitching(true);
    try {
      const response = await fetch(`/api/profiles/${profileId}/select`, {
        method: "POST",
      });

      if (response.ok) {
        // Refresh the page to load the new profile's data
        router.refresh();
        // Also do a hard reload to ensure all data is fresh
        window.location.reload();
      } else {
        console.error("Failed to select profile");
      }
    } catch (error) {
      console.error("Failed to select profile:", error);
    } finally {
      setSwitching(false);
    }
  };

  const handleAddProfile = () => {
    router.push("/onboarding?mode=add");
  };

  // If only one profile or no profiles, don't show the switcher
  if (profiles.length <= 1 && !loading) {
    return null;
  }

  const displayName = currentProfileName || "Profil Seç";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 px-2 h-8 font-medium",
            switching && "opacity-50 cursor-wait",
            className,
          )}
          disabled={switching}
        >
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[120px] truncate">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {loading ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">Yükleniyor...</span>
          </DropdownMenuItem>
        ) : (
          <>
            {profiles.map((profile) => (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => handleSelectProfile(profile.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{profile.display_name}</span>
                  {profile.report_count !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {profile.report_count} rapor
                    </span>
                  )}
                </div>
                {profile.id === currentProfileId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleAddProfile}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>Yeni Profil Ekle</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
