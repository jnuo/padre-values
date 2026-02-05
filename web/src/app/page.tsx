"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { FileText, BarChart3, Shield, Zap, LucideIcon } from "lucide-react";

const COLOR_MAP = {
  primary: {
    border: "border-l-primary",
    bg: "bg-primary/10",
    text: "text-primary",
  },
  secondary: {
    border: "border-l-secondary",
    bg: "bg-secondary/10",
    text: "text-secondary",
  },
  "status-normal": {
    border: "border-l-status-normal",
    bg: "bg-status-normal/10",
    text: "text-status-normal",
  },
} as const;

type ColorKey = keyof typeof COLOR_MAP;

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  colorKey: ColorKey;
};

function FeatureCard({
  icon: Icon,
  title,
  description,
  colorKey,
}: FeatureCardProps): React.ReactElement {
  const colors = COLOR_MAP[colorKey];
  return (
    <Card
      className={`border-l-4 ${colors.border} hover:shadow-lg transition-shadow duration-200`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.text}`} />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

const FEATURES: FeatureCardProps[] = [
  {
    icon: Zap,
    title: "AI Destekli Analiz",
    description:
      "AI'mız PDF raporlarınızdan otomatik olarak veri çıkarır ve yapılandırır, trendleri ve kalıpları zaman içinde takip etmeyi kolaylaştırır.",
    colorKey: "primary",
  },
  {
    icon: BarChart3,
    title: "Görsel Dashboard",
    description:
      "Net içgörüler için tasarlanmış sezgisel dashboard'umuzla birden fazla laboratuvar metriğini zaman içinde tek bakışta karşılaştırın.",
    colorKey: "secondary",
  },
  {
    icon: FileText,
    title: "Kolay PDF Yükleme",
    description:
      "e-Nabız'dan veya herhangi bir laboratuvardan aldığınız PDF raporlarını sürükleyip bırakın. Sistem otomatik olarak verileri tanır ve işler.",
    colorKey: "status-normal",
  },
  {
    icon: Shield,
    title: "Güvenli ve Özel",
    description:
      "Verileriniz şifreli olarak saklanır ve sadece sizinle paylaşılır. Gizliliğiniz bizim için en önemli önceliktir.",
    colorKey: "primary",
  },
];

export default function Home(): React.ReactElement {
  const router = useRouter();
  const { status } = useSession();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  // Show nothing while checking auth or redirecting
  if (status === "loading" || status === "authenticated") {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
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
              asChild
              className="px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              <Link href="/login">Hemen Başla</Link>
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
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
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
          <Button size="lg" asChild className="px-8 py-6 text-lg font-semibold">
            <Link href="/login">Ücretsiz Deneyin</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 ViziAI. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
