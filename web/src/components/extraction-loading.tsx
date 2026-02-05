"use client";

import { useEffect, useState } from "react";
import { FileText, Sparkles, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const MESSAGES = [
  "PDF okunuyor…",
  "Sayfalar taranıyor…",
  "Tahlil değerleri bulunuyor…",
  "Referans aralıkları kontrol ediliyor…",
  "Metrik isimleri normalize ediliyor…",
  "Veriler yapılandırılıyor…",
];

interface ExtractionLoadingProps {
  fileName?: string;
  uploadTime?: string;
  onCancel?: () => void;
}

export function ExtractionLoading({
  fileName,
  uploadTime,
  onCancel,
}: ExtractionLoadingProps): React.ReactElement {
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center py-12 px-4">
      {/* Animated document with scanning effect */}
      <div className="relative mb-8">
        {/* Document background */}
        <div className="w-32 h-40 bg-gradient-to-b from-muted to-muted/50 rounded-lg border border-border shadow-lg relative overflow-hidden">
          {/* Document lines */}
          <div className="absolute inset-4 space-y-2">
            <div className="h-2 bg-muted-foreground/20 rounded w-3/4" />
            <div className="h-2 bg-muted-foreground/20 rounded w-full" />
            <div className="h-2 bg-muted-foreground/20 rounded w-5/6" />
            <div className="h-2 bg-muted-foreground/20 rounded w-full" />
            <div className="h-2 bg-muted-foreground/20 rounded w-2/3" />
            <div className="h-2 bg-muted-foreground/20 rounded w-full" />
            <div className="h-2 bg-muted-foreground/20 rounded w-4/5" />
          </div>

          {/* Scanning line animation */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-0 right-0 h-8 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent animate-scan" />
          </div>

          {/* Corner fold */}
          <div className="absolute top-0 right-0 w-6 h-6 bg-background border-l border-b border-border rounded-bl-lg" />
        </div>

        {/* AI brain icon */}
        <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg animate-pulse motion-reduce:animate-none">
          <Brain className="w-6 h-6 text-primary-foreground" />
        </div>

        {/* Floating sparkles */}
        <div className="absolute -top-2 -left-2 animate-bounce motion-reduce:animate-none delay-100">
          <Sparkles className="w-5 h-5 text-secondary" />
        </div>
        <div className="absolute top-1/2 -right-4 animate-bounce motion-reduce:animate-none delay-300">
          <Sparkles className="w-4 h-4 text-primary/60" />
        </div>
      </div>

      {/* Main message */}
      <h3 className="text-xl font-semibold text-foreground mb-2">
        AI Analiz Ediyor
      </h3>

      {/* Cycling status message */}
      <div className="h-6 flex items-center justify-center mb-4">
        <p className="text-muted-foreground animate-fade-in" key={messageIndex}>
          {MESSAGES[messageIndex]}
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-6">
        {[0, 1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={cn(
              "w-2 h-2 rounded-full transition-[background-color,transform] duration-300",
              step <= Math.floor(messageIndex * 0.8)
                ? "bg-primary scale-100"
                : "bg-muted-foreground/30 scale-75",
            )}
          />
        ))}
      </div>

      {/* File name and upload time */}
      {fileName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <FileText className="w-4 h-4" />
          <span className="truncate max-w-[200px]">{fileName}</span>
          {uploadTime && (
            <>
              <span className="text-muted-foreground/50">-</span>
              <span>{uploadTime}</span>
            </>
          )}
        </div>
      )}

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg transition-colors"
        >
          İptal
        </button>
      )}

      {/* Scanning animation keyframes */}
      <style jsx>{`
        @keyframes scan {
          0%,
          100% {
            transform: translateY(-100%);
          }
          50% {
            transform: translateY(400%);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-scan,
          .animate-fade-in {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
