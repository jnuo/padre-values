"use client";

import { Header } from "@/components/header";
import { useActiveProfile } from "@/hooks/use-active-profile";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeProfile, activeProfileId } = useActiveProfile();

  return (
    <div className="min-h-screen bg-background">
      <Header
        profileName={activeProfile?.display_name}
        currentProfileId={activeProfileId || undefined}
      />
      <main className="container max-w-4xl mx-auto p-4">{children}</main>
    </div>
  );
}
