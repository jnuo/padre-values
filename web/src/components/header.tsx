"use client";

import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  /** User's profile name to display. If null, shows login button instead of user menu */
  profileName?: string | null;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Callback when login is clicked */
  onLogin?: () => void;
}

/**
 * ViziAI Logo Wordmark
 * "Vizi" in brand primary (teal), "AI" in brand secondary (coral)
 */
function ViziAILogo({ onClick }: { onClick?: () => void }) {
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
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled>
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(isDark ? "light" : "dark")}
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
 * - Dark/light mode toggle
 * - User menu or login button depending on auth state
 */
export function Header({ profileName, onLogout, onLogin }: HeaderProps) {
  const router = useRouter();

  const handleLogoClick = () => {
    router.push("/");
  };

  const handleLoginClick = () => {
    if (onLogin) {
      onLogin();
    } else {
      router.push("/login");
    }
  };

  const handleLogoutClick = async () => {
    if (onLogout) {
      onLogout();
    } else {
      // Default logout behavior using NextAuth
      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/login" });
    }
  };

  const isLoggedIn = profileName !== undefined && profileName !== null;

  return (
    <header className="border-b bg-card">
      <nav
        className="flex items-center justify-between px-4 py-3 sm:px-6 md:px-8"
        aria-label="Ana navigasyon"
      >
        <ViziAILogo onClick={handleLogoClick} />

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {isLoggedIn ? (
            <>
              <span className="text-sm font-medium hidden sm:inline text-foreground">
                {profileName || "Kullanıcı"}
              </span>
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
