"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { FileText, BarChart3, Shield, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

        <div className="container relative mx-auto px-4 py-12 md:py-16 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Tahlil Sonuçlarını <span className="text-primary">Kolayca</span>{" "}
              Anlayın
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              e-Nabız veya laboratuvar PDF&apos;lerinizi yükleyin. ViziAI
              değerleri otomatik çıkarır ve onlarca tahlili tek ekranda,
              anlaşılır grafiklerle karşılaştırır.
            </p>
            <Button
              size="lg"
              onClick={() => router.push("/login")}
              className="px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Hemen Başla
            </Button>
          </div>

          {/* Dashboard Preview */}
          <div className="mb-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-primary/20">
              <Image
                src="/dashboard.jpeg"
                alt="ViziAI Dashboard Preview"
                width={1200}
                height={800}
                className="w-full h-auto"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              ViziAI Dashboard - Test sonuçlarınızı görsel olarak takip edin
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Neden <span className="text-primary">ViziAI</span>?
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-l-4 border-l-primary hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">AI Destekli Analiz</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  AI&apos;mız PDF raporlarınızdan otomatik olarak veri çıkarır
                  ve yapılandırır, trendleri ve kalıpları zaman içinde takip
                  etmeyi kolaylaştırır.
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-secondary hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <BarChart3 className="h-5 w-5 text-secondary" />
                  </div>
                  <CardTitle className="text-lg">Görsel Dashboard</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Net içgörüler için tasarlanmış sezgisel dashboard&apos;umuzla
                  birden fazla laboratuvar metriğini zaman içinde tek bakışta
                  karşılaştırın.
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-status-normal hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-status-normal/10">
                    <FileText className="h-5 w-5 text-status-normal" />
                  </div>
                  <CardTitle className="text-lg">Kolay PDF Yükleme</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  e-Nabız&apos;dan veya herhangi bir laboratuvardan aldığınız
                  PDF raporlarını sürükleyip bırakın. Sistem otomatik olarak
                  verileri tanır ve işler.
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Güvenli ve Özel</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Verileriniz şifreli olarak saklanır ve sadece sizinle
                  paylaşılır. Gizliliğiniz bizim için en önemli önceliktir.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Sağlığınızı Takip Etmeye Başlayın
          </h2>
          <p className="text-muted-foreground mb-6">
            Tahlil sonuçlarınızı anlamak hiç bu kadar kolay olmamıştı.
          </p>
          <Button
            size="lg"
            onClick={() => router.push("/login")}
            className="px-8 py-6 text-lg font-semibold"
          >
            Ücretsiz Deneyin
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 ViziAI. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
