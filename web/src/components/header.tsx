"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Moon,
  Sun,
  Upload,
  Plus,
  Heart,
  Scale,
  LogOut,
  Users,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { AddBloodPressureDialog } from "@/components/add-blood-pressure-dialog";
import { AddWeightDialog } from "@/components/add-weight-dialog";

interface HeaderProps {
  profileName?: string | null;
  currentProfileId?: string;
  onLogout?: () => void;
  onLogin?: () => void;
}

function ViziAILogo({ onClick }: { onClick?: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      className="text-xl sm:text-2xl font-bold cursor-pointer select-none flex items-baseline bg-transparent border-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
      onClick={onClick}
      aria-label="ViziAI - Ana sayfa"
    >
      <span className="text-primary hover:text-primary/80 transition-colors">
        Vizi
      </span>
      <span className="text-secondary hover:text-secondary/80 transition-colors">
        AI
      </span>
    </button>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header({
  profileName,
  currentProfileId,
  onLogout,
  onLogin,
}: HeaderProps): React.ReactElement {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [bpDialogOpen, setBpDialogOpen] = useState(false);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);

  const isLoggedIn = status === "authenticated";
  const isDark = theme === "dark";
  const userName = session?.user?.name;

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleLogoClick(): void {
    router.push("/dashboard");
  }

  function handleLoginClick(): void {
    if (onLogin) {
      onLogin();
      return;
    }
    router.push("/login");
  }

  async function handleLogoutClick(): Promise<void> {
    if (onLogout) {
      onLogout();
      return;
    }
    const { signOut } = await import("next-auth/react");
    await signOut({ callbackUrl: "/" });
  }

  function handleTrackingSaved(): void {
    window.dispatchEvent(new Event("tracking-updated"));
  }

  return (
    <>
      <header className="border-b bg-card">
        <nav
          className="flex items-center justify-between px-3 py-2.5 sm:px-6 md:px-8"
          aria-label="Ana navigasyon"
        >
          {/* Left: Logo + Profile Switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            <ViziAILogo onClick={handleLogoClick} />
            {isLoggedIn && (
              <ProfileSwitcher
                currentProfileId={currentProfileId}
                currentProfileName={profileName ?? undefined}
              />
            )}
          </div>

          {/* Right: Nav + Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Tahliller nav link — desktop only */}
            {isLoggedIn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/settings")}
                className="hidden sm:flex gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <FileText className="h-4 w-4" />
                Tahliller
              </Button>
            )}

            {/* + Ekle dropdown */}
            {isLoggedIn && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-primary/30 hover:border-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Ekle</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setBpDialogOpen(true)}
                    className="cursor-pointer"
                  >
                    <Heart className="h-4 w-4 text-status-critical" />
                    Tansiyon Ekle
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setWeightDialogOpen(true)}
                    className="cursor-pointer"
                  >
                    <Scale className="h-4 w-4 text-primary" />
                    Kilo Ekle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => router.push("/upload")}
                    className="cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                    Tahlil Yükle
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User avatar dropdown */}
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    aria-label="Kullanıcı menüsü"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <span className="text-xs font-semibold text-primary">
                        {getInitials(userName)}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Mobile-only: Tahliller */}
                  <DropdownMenuItem
                    onClick={() => router.push("/settings")}
                    className="sm:hidden cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    Tahliller
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/settings/access")}
                    className="cursor-pointer"
                  >
                    <Users className="h-4 w-4" />
                    Profiller
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {mounted && (
                    <DropdownMenuItem
                      onClick={() => setTheme(isDark ? "light" : "dark")}
                      className="cursor-pointer"
                    >
                      {isDark ? (
                        <Sun className="h-4 w-4 text-brand-secondary" />
                      ) : (
                        <Moon className="h-4 w-4 text-brand-primary" />
                      )}
                      {isDark ? "Açık Tema" : "Koyu Tema"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogoutClick}
                    className="cursor-pointer"
                    variant="destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Çıkış
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="default" size="sm" onClick={handleLoginClick}>
                Giriş Yap
              </Button>
            )}
          </div>
        </nav>
      </header>

      {/* Tracking Dialogs (owned by header, accessible from any page) */}
      {isLoggedIn && currentProfileId && profileName && (
        <>
          <AddBloodPressureDialog
            open={bpDialogOpen}
            onOpenChange={setBpDialogOpen}
            profileId={currentProfileId}
            profileName={profileName}
            onSaved={handleTrackingSaved}
          />
          <AddWeightDialog
            open={weightDialogOpen}
            onOpenChange={setWeightDialogOpen}
            profileId={currentProfileId}
            profileName={profileName}
            onSaved={handleTrackingSaved}
          />
        </>
      )}
    </>
  );
}
