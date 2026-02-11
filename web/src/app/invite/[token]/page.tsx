"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type InviteStatus =
  | "loading"
  | "pending"
  | "claimed"
  | "revoked"
  | "expired"
  | "not_found"
  | "error";

interface InviteData {
  status: InviteStatus;
  email?: string;
  accessLevel?: string;
  profileName?: string;
  inviteEmail?: string;
}

const ACCESS_LABELS: Record<string, string> = {
  editor: "Düzenleyici",
  viewer: "Görüntüleyici",
};

export default function InviteClaimPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = params.token as string;

  const [inviteData, setInviteData] = useState<InviteData>({
    status: "loading",
  });
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState<string | null>(null);

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setInviteData({ status: data.status || "not_found" });
          return;
        }

        setInviteData(data);
      } catch {
        setInviteData({ status: "error" });
      }
    }

    fetchInvite();
  }, [token]);

  const handleLogin = () => {
    signIn("google", {
      callbackUrl: `/invite/${token}`,
    });
  };

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    setEmailMismatch(null);

    try {
      const res = await fetch(`/api/invite/${token}/claim`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data.inviteEmail) {
          setEmailMismatch(data.inviteEmail);
        } else {
          setClaimError(data.error || "Davet kabul edilemedi");
        }
        return;
      }

      // Success — redirect to dashboard
      router.push("/dashboard");
    } catch {
      setClaimError("Bir hata oluştu");
    } finally {
      setClaiming(false);
    }
  };

  // Loading state
  if (inviteData.status === "loading" || sessionStatus === "loading") {
    return (
      <PageWrapper>
        <Card className="w-full max-w-md">
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  // Not found
  if (inviteData.status === "not_found") {
    return (
      <PageWrapper>
        <StatusCard
          icon={<XCircle className="h-8 w-8 text-destructive" />}
          title="Davet Bulunamadı"
          description="Bu bağlantı geçerli değil."
        />
      </PageWrapper>
    );
  }

  // Revoked
  if (inviteData.status === "revoked") {
    return (
      <PageWrapper>
        <StatusCard
          icon={<XCircle className="h-8 w-8 text-destructive" />}
          title="Davet İptal Edilmiş"
          description={`${inviteData.profileName} profiline erişim daveti iptal edilmiş.`}
        />
      </PageWrapper>
    );
  }

  // Already claimed
  if (inviteData.status === "claimed") {
    return (
      <PageWrapper>
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-primary" />}
          title="Davet Zaten Kullanılmış"
          description="Bu davet daha önce kabul edilmiş."
        />
      </PageWrapper>
    );
  }

  // Expired
  if (inviteData.status === "expired") {
    return (
      <PageWrapper>
        <StatusCard
          icon={<Clock className="h-8 w-8 text-muted-foreground" />}
          title="Davet Süresi Dolmuş"
          description={`${inviteData.profileName} profiline erişim davetinin süresi dolmuş.`}
        />
      </PageWrapper>
    );
  }

  // Error
  if (inviteData.status === "error") {
    return (
      <PageWrapper>
        <StatusCard
          icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
          title="Hata"
          description="Davet bilgileri yüklenirken bir hata oluştu."
        />
      </PageWrapper>
    );
  }

  // Pending invite -- show claim UI
  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user;

  return (
    <PageWrapper>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 text-3xl font-bold text-primary">ViziAI</div>
          <CardTitle className="text-xl">Profil Daveti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Sizi aşağıdaki profile davet etti:
            </p>
            <p className="font-semibold text-lg">{inviteData.profileName}</p>
            <p className="text-sm text-muted-foreground">
              Erişim seviyesi:{" "}
              <span className="font-medium text-foreground">
                {ACCESS_LABELS[inviteData.accessLevel || ""] ||
                  inviteData.accessLevel}
              </span>
            </p>
          </div>

          <PendingAction
            isLoggedIn={isLoggedIn}
            emailMismatch={emailMismatch}
            sessionEmail={session?.user?.email}
            claimError={claimError}
            claiming={claiming}
            onLogin={handleLogin}
            onClaim={handleClaim}
          />
        </CardContent>
      </Card>
    </PageWrapper>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {children}
    </div>
  );
}

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function StatusCard({ icon, title, description }: StatusCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="py-8 text-center space-y-3">
        <div className="flex justify-center">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface PendingActionProps {
  isLoggedIn: boolean;
  emailMismatch: string | null;
  sessionEmail?: string | null;
  claimError: string | null;
  claiming: boolean;
  onLogin: () => void;
  onClaim: () => void;
}

function PendingAction({
  isLoggedIn,
  emailMismatch,
  sessionEmail,
  claimError,
  claiming,
  onLogin,
  onClaim,
}: PendingActionProps) {
  if (!isLoggedIn) {
    return (
      <Button onClick={onLogin} className="w-full h-12" variant="outline">
        <span className="flex items-center gap-3">
          <GoogleIcon />
          Google ile Giriş Yap
        </span>
      </Button>
    );
  }

  if (emailMismatch) {
    return (
      <div className="bg-muted rounded-lg p-4 text-center space-y-2">
        <p className="text-sm font-medium">E-posta adresi uyuşmuyor</p>
        <p className="text-sm text-muted-foreground">
          Bu davet <span className="font-medium">{emailMismatch}</span> için
          gönderildi.
        </p>
        <p className="text-xs text-muted-foreground">
          Şu anda <span className="font-medium">{sessionEmail}</span> ile giriş
          yapmış durumdasınız.
        </p>
      </div>
    );
  }

  return (
    <>
      {claimError && (
        <p className="text-sm text-destructive text-center">{claimError}</p>
      )}
      <Button onClick={onClaim} className="w-full" disabled={claiming}>
        {claiming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Daveti Kabul Et
      </Button>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
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
  );
}
