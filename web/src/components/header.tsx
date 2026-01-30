"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Upload, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileSwitcher } from "@/components/profile-switcher";

interface HeaderProps {
  /** User's profile name to display. If null, shows login button instead of user menu */
  profileName?: string | null;
  /** Current profile ID for the profile switcher */
  currentProfileId?: string;
  /** Whether to show the upload button */
  showUploadButton?: boolean;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Callback when login is clicked */
  onLogin?: () => void;
}

/**
 * ViziAI Logo Wordmark
 * "Vizi" in brand primary (teal), "AI" in brand secondary (coral)
 */
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

/**
 * Theme toggle button
 * Switches between light and dark mode
 */
function ThemeToggle(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  function toggleTheme(): void {
    setTheme(isDark ? "light" : "dark");
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-brand-secondary" />
      ) : (
        <Moon className="h-4 w-4 text-brand-primary" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

/**
 * Shared header component for ViziAI
 * - Two-color wordmark (Vizi in teal, AI in coral)
 * - Profile switcher (when logged in with multiple profiles)
 * - Dark/light mode toggle
 * - User menu or login button depending on auth state
 */
export function Header({
  profileName,
  currentProfileId,
  showUploadButton = false,
  onLogout,
  onLogin,
}: HeaderProps): React.ReactElement {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  function handleLogoClick(): void {
    router.push("/");
  }

  function handleLoginClick(): void {
    if (onLogin) {
      onLogin();
      return;
    }
    router.push("/login");
  }

  function handleUploadClick(): void {
    router.push("/upload");
  }

  function handleSettingsClick(): void {
    router.push("/settings");
  }

  async function handleLogoutClick(): Promise<void> {
    if (onLogout) {
      onLogout();
      return;
    }
    const { signOut } = await import("next-auth/react");
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="border-b bg-card">
      <nav
        className="flex items-center justify-between px-4 py-3 sm:px-6 md:px-8"
        aria-label="Ana navigasyon"
      >
        <div className="flex items-center gap-4">
          <ViziAILogo onClick={handleLogoClick} />

          {/* Profile Switcher - only show when logged in */}
          {isLoggedIn && (
            <ProfileSwitcher
              currentProfileId={currentProfileId}
              currentProfileName={profileName ?? undefined}
              className="hidden sm:flex"
            />
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Upload Button */}
          {isLoggedIn && showUploadButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              className="gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/5"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Yükle</span>
            </Button>
          )}

          {/* Settings Button */}
          {isLoggedIn && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleSettingsClick}
              aria-label="Ayarlar"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}

          <ThemeToggle />

          {isLoggedIn ? (
            <>
              {/* Mobile Profile Switcher */}
              <ProfileSwitcher
                currentProfileId={currentProfileId}
                currentProfileName={profileName ?? undefined}
                className="sm:hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoutClick}
                className="border-primary/30 hover:border-primary hover:bg-primary/5"
              >
                Çıkış
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={handleLoginClick}>
              Giriş Yap
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}

export { ViziAILogo, ThemeToggle };
