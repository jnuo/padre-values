"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Crown,
  Eye,
  Pencil,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/error-reporting";

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
        reportError(error, { op: "profileSwitcher.fetch" });
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
      reportError(error, { op: "profileSwitcher.select", profileId });
    } finally {
      setSwitching(false);
    }
  };

  const handleAddProfile = () => {
    router.push("/onboarding?mode=add");
  };

  // Always show the switcher so users can add new profiles

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
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{profile.display_name}</span>
                    <AccessBadge level={profile.access_level} />
                  </div>
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

function AccessBadge({ level }: { level: string }) {
  switch (level) {
    case "owner":
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
          <Crown className="h-3 w-3" />
          Sahip
        </span>
      );
    case "editor":
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Pencil className="h-3 w-3" />
          Düzenleyici
        </span>
      );
    case "viewer":
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Eye className="h-3 w-3" />
          Görüntüleyici
        </span>
      );
    default:
      return null;
  }
}
