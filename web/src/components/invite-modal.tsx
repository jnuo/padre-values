"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface KnownUser {
  email: string;
  name: string | null;
}

interface InviteModalProps {
  profileId: string;
  profileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knownUsers?: KnownUser[];
}

type Step = "form" | "success";

export function InviteModal({
  profileId,
  profileName,
  open,
  onOpenChange,
  knownUsers = [],
}: InviteModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/profiles/${profileId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), accessLevel }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Davet gönderilemedi");
        return;
      }

      setInviteUrl(data.invite.inviteUrl);
      setStep("success");
    } catch {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = `${profileName} profilini seninle paylaşmak istiyorum. Bu bağlantıyla erişim sağlayabilirsin: ${inviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state on close
      setStep("form");
      setEmail("");
      setAccessLevel("viewer");
      setError(null);
      setInviteUrl("");
      setCopied(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? `${profileName} — Davet Et` : "Davet Bağlantısı"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {knownUsers.length > 0 && (
              <div className="space-y-2">
                <Label>Mevcut Kişiler</Label>
                <div className="flex flex-wrap gap-2">
                  {knownUsers.map((user) => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={() => setEmail(user.email)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                        email === user.email
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                        {user.name
                          ? user.name[0].toUpperCase()
                          : user.email[0].toUpperCase()}
                      </span>
                      {user.name || user.email}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-email">
                {knownUsers.length > 0 ? "Veya e-posta girin" : "E-posta"}
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-level">Erişim Seviyesi</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger id="invite-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Görüntüleyici</SelectItem>
                  <SelectItem value="editor">Düzenleyici</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Davet Et
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bu bağlantıyı davet edilen kişiyle paylaşın:
            </p>

            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleWhatsApp}
            >
              WhatsApp ile Paylaş
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
