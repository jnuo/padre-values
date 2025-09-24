"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const router = useRouter();

  const handleLogin = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-8">
          <h1 className="text-2xl font-bold">ViziAI</h1>
          <Button onClick={handleLogin} variant="default">
            Giriş Yap
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">ViziAI - Tahlil Sonuçlarını Kolayca Anlayın</h2>
          <p className="text-xl text-muted-foreground mb-8">
          e-Nabız veya laboratuvar PDF'lerinizi yükleyin. ViziAI değerleri otomatik çıkarır ve onlarca tahlili tek ekranda, anlaşılır grafiklerle karşılaştırır.
          </p>
        </div>

        {/* Dashboard Preview */}
        <div className="mb-12">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border">
            <Image
              src="/dashboard.jpeg"
              alt="ViziAI Dashboard Preview"
              width={1200}
              height={800}
              className="w-full h-auto"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            ViziAI Dashboard - Test sonuçlarınızı görsel olarak takip edin
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>AI Destekli Analiz</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                AI'mız PDF raporlarınızdan otomatik olarak veri çıkarır ve yapılandırır, 
                trendleri ve kalıpları zaman içinde takip etmeyi kolaylaştırır.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Görsel Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Net içgörüler için tasarlanmış sezgisel dashboard'umuzla 
                birden fazla laboratuvar metriğini zaman içinde tek bakışta karşılaştırın.
              </p>
            </CardContent>
          </Card>
        </div>

        
      </main>
    </div>
  );
}
