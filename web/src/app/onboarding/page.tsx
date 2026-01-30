"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Upload, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/header";

type Step = "welcome" | "create-profile" | "upload-prompt" | "complete";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddMode = searchParams.get("mode") === "add";

  const [step, setStep] = useState<Step>(
    isAddMode ? "create-profile" : "welcome",
  );
  const [profileName, setProfileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProfile = async () => {
    if (!profileName.trim()) {
      setError("Profil adı gerekli");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: profileName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Profil oluşturulamadı");
        return;
      }

      // Select this profile as active
      await fetch(`/api/profiles/${data.profile.id}/select`, {
        method: "POST",
      });

      setStep("upload-prompt");
    } catch (err) {
      console.error("Create profile error:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoToUpload = () => {
    router.push("/upload");
  };

  const handleSkipToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-lg mx-auto p-4 pt-12">
        {/* Welcome Step */}
        {step === "welcome" && (
          <Card className="text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-3xl">🩺</span>
              </div>
              <CardTitle className="text-2xl">
                ViziAI&apos;ya Hoş Geldiniz
              </CardTitle>
              <CardDescription className="text-base">
                Tahlil sonuçlarınızı görselleştirin ve sağlık trendlerinizi
                takip edin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div className="text-left space-y-3 bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Profil oluşturun</p>
                    <p className="text-sm text-muted-foreground">
                      Kendiniz veya aile üyeleriniz için
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">2</span>
                  </div>
                  <div>
                    <p className="font-medium">PDF yükleyin</p>
                    <p className="text-sm text-muted-foreground">
                      AI tahlil raporlarınızı otomatik analiz eder
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Trendleri takip edin</p>
                    <p className="text-sm text-muted-foreground">
                      Zaman içinde değişimleri görselleştirin
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep("create-profile")}
                className="w-full gap-2"
              >
                Başlayın
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Profile Step */}
        {step === "create-profile" && (
          <Card>
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <User className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-center">
                {isAddMode ? "Yeni Profil Ekle" : "Profil Oluşturun"}
              </CardTitle>
              <CardDescription className="text-center">
                Tahlil sonuçlarını takip etmek istediğiniz kişinin adını girin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profileName">Profil Adı</Label>
                <Input
                  id="profileName"
                  placeholder="örn: Yüksel O."
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateProfile();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Bu ad sadece size görünür ve istediğiniz zaman
                  değiştirebilirsiniz
                </p>
              </div>

              {error && <p className="text-sm text-status-critical">{error}</p>}

              <div className="flex gap-3">
                {isAddMode && (
                  <Button
                    variant="outline"
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                )}
                <Button
                  onClick={handleCreateProfile}
                  disabled={!profileName.trim() || isCreating}
                  className="flex-1"
                >
                  {isCreating ? "Oluşturuluyor..." : "Profil Oluştur"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Prompt Step */}
        {step === "upload-prompt" && (
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-status-normal/10 flex items-center justify-center mb-2">
                <Check className="h-6 w-6 text-status-normal" />
              </div>
              <CardTitle>Profil Oluşturuldu</CardTitle>
              <CardDescription>
                Şimdi ilk tahlil raporunuzu yükleyebilirsiniz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 bg-muted/30">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">PDF Yükle</p>
                <p className="text-sm text-muted-foreground">
                  Tahlil raporlarınızı otomatik olarak analiz edeceğiz
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleGoToUpload} className="w-full gap-2">
                  <Upload className="h-4 w-4" />
                  Rapor Yükle
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSkipToDashboard}
                  className="w-full text-muted-foreground"
                >
                  Şimdilik Atla
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <OnboardingContent />
    </Suspense>
  );
}
