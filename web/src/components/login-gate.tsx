"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type UserConfig = {
  id: string;
  name: string;
  username: string;
  dataSheetName: string;
  referenceSheetName: string;
};

type LoginGateProps = {
  onLogin: (userConfig: UserConfig) => void;
};

export function LoginGate({ onLogin }: LoginGateProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const { user } = await response.json();
        onLogin(user);
      } else {
        const { error } = await response.json();
        setError(error || "Geçersiz kullanıcı adı veya şifre");
      }
    } catch {
      setError("Giriş yapılırken bir hata oluştu");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Tahlil Sonuçları</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Giriş yapmak için kimlik bilgilerinizi girin
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı girin"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifrenizi girin"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}
            <Button type="submit" className="w-full">
              Giriş Yap
            </Button>
          </form>
          <div className="mt-4 text-xs text-muted-foreground text-center">
            <p>Güvenli giriş için kimlik bilgilerinizi girin</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
