import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ViziAI - Tahlil Sonuçlarınızı Kolayca Anlamlandırın",
  description: "E-nabız'dan veya laboratuar sayfalarından indirdiğiniz tahlil sonuçlarını PDF (veya herhangi bir formatta) yükleyin. ViziAI yapay zeka ile bu verileri düzenli bir formata ta analiz eder, farklıl değerleri kolayca annlaşılır ve karşılaştırılabilir bir arayüzde incelemenizi sağlar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
