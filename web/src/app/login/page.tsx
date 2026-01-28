"use client";

import { Suspense, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for error in URL params (from OAuth callback)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "AccessDenied") {
        setError("Bu e-posta adresiyle giriş izniniz bulunmamaktadır.");
      } else {
        setError(errorParam);
      }
    }
  }, [searchParams]);

  // Get the redirect destination (from middleware or default to dashboard)
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push(redirectTo);
    }
  }, [status, session, router, redirectTo]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signIn("google", {
        callbackUrl: redirectTo,
      });
      // Browser will redirect to Google OAuth
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Giriş yapılırken bir hata oluştu");
      setIsLoading(false);
    }
  };

  // Show loading state while checking session
  if (status === "loading") {
    return <LoginFallback />;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mb-4">
          <h1
            className="text-3xl font-bold text-primary cursor-pointer hover:text-primary/80"
            onClick={() => router.push("/")}
          >
            ViziAI
          </h1>
        </div>
        <CardTitle className="text-2xl">Tahlil Sonuçları</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Google hesabınızla giriş yapın
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 rounded-lg text-center">
            {error}
          </div>
        )}

        <Button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full h-12 text-base"
          variant="outline"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Yönlendiriliyor...
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google ile Giriş Yap
            </span>
          )}
        </Button>

        <div className="mt-6 text-xs text-muted-foreground text-center">
          <p>
            Giriş yaparak{" "}
            <a href="#" className="underline hover:text-foreground">
              Kullanım Koşulları
            </a>{" "}
            ve{" "}
            <a href="#" className="underline hover:text-foreground">
              Gizlilik Politikası
            </a>
            &apos;nı kabul etmiş olursunuz.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoginFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-primary">ViziAI</h1>
        </div>
        <CardTitle className="text-2xl">Tahlil Sonuçları</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">Yükleniyor...</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-12 bg-muted animate-pulse rounded-md" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={<LoginFallback />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
