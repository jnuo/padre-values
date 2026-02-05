import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ViziAI - Tahlil Sonuçlarınızı Kolayca Anlamlandırın",
  description:
    "E-nabız'dan veya laboratuar sayfalarından indirdiğiniz tahlil sonuçlarını PDF (veya herhangi bir formatta) yükleyin. ViziAI yapay zeka ile bu verileri düzenli bir formata ta analiz eder, farklıl değerleri kolayca annlaşılır ve karşılaştırılabilir bir arayüzde incelemenizi sağlar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <meta
          name="theme-color"
          content="hsl(0 0% 100%)"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="hsl(240 10% 3.9%)"
          media="(prefers-color-scheme: dark)"
        />
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7SD063Z4ST"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-7SD063Z4ST');
          `}
        </Script>
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
