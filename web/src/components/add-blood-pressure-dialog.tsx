"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Loader2, Heart } from "lucide-react";
import {
  getBPStatus,
  formatTrackingDateTime,
  type TrackingMeasurement,
} from "@/lib/tracking";

interface AddBloodPressureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
  recentMeasurements?: TrackingMeasurement[];
  onSaved?: () => void;
}

export function AddBloodPressureDialog({
  open,
  onOpenChange,
  profileId,
  profileName,
  recentMeasurements = [],
  onSaved,
}: AddBloodPressureDialogProps) {
  const { addToast } = useToast();
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [saving, setSaving] = useState(false);

  const systolicNum = parseInt(systolic);
  const diastolicNum = parseInt(diastolic);
  const hasValidInput =
    !isNaN(systolicNum) &&
    !isNaN(diastolicNum) &&
    systolicNum > 0 &&
    diastolicNum > 0;
  const status = hasValidInput ? getBPStatus(systolicNum, diastolicNum) : null;

  async function handleSave() {
    if (!hasValidInput) return;
    setSaving(true);

    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          type: "blood_pressure",
          systolic: systolicNum,
          diastolic: diastolicNum,
          pulse: pulse ? parseInt(pulse) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kayıt başarısız");
      }

      addToast({
        type: "success",
        message: "Tansiyon kaydedildi",
        duration: 3000,
      });
      setSystolic("");
      setDiastolic("");
      setPulse("");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      addToast({
        type: "error",
        message: (err as Error).message || "Bir hata oluştu",
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }

  const recent = recentMeasurements
    .filter((m) => m.type === "blood_pressure")
    .slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-status-critical" />
            Tansiyon Ekle
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{profileName}</span>{" "}
            için ölçüm ekliyorsunuz
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Main BP Input */}
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label
                  htmlFor="systolic"
                  className="text-xs text-muted-foreground"
                >
                  Sistolik (büyük)
                </Label>
                <Input
                  id="systolic"
                  type="number"
                  inputMode="numeric"
                  placeholder="120"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  className="h-14 text-2xl font-semibold text-center tabular-nums"
                  min={50}
                  max={300}
                  autoFocus
                />
              </div>
              <span className="text-2xl font-light text-muted-foreground pb-3">
                /
              </span>
              <div className="flex-1 space-y-1.5">
                <Label
                  htmlFor="diastolic"
                  className="text-xs text-muted-foreground"
                >
                  Diastolik (küçük)
                </Label>
                <Input
                  id="diastolic"
                  type="number"
                  inputMode="numeric"
                  placeholder="80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  className="h-14 text-2xl font-semibold text-center tabular-nums"
                  min={20}
                  max={200}
                />
              </div>
              <span className="text-sm text-muted-foreground pb-4">mmHg</span>
            </div>

            {/* Status indicator */}
            {status && (
              <div
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                  status.bg,
                  status.color,
                )}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-current" />
                {status.label} — {systolicNum}/{diastolicNum}
              </div>
            )}
          </div>

          {/* Pulse (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="pulse" className="text-xs text-muted-foreground">
              Nabız (isteğe bağlı)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="pulse"
                type="number"
                inputMode="numeric"
                placeholder="72"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                className="h-10 w-24 text-center tabular-nums"
                min={20}
                max={250}
              />
              <span className="text-sm text-muted-foreground">bpm</span>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!hasValidInput || saving}
            className="w-full h-12 text-base"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kaydet"}
          </Button>

          {/* Recent Measurements */}
          {recent.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground font-medium">
                Son ölçümler
              </div>
              <div className="space-y-1.5">
                {recent.map((m) => {
                  const s = getBPStatus(m.systolic!, m.diastolic!);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/50"
                    >
                      <span className="text-muted-foreground text-xs">
                        {formatTrackingDateTime(m.measured_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">
                          {m.systolic}/{m.diastolic}
                        </span>
                        {m.pulse && (
                          <span className="text-xs text-muted-foreground">
                            {m.pulse} bpm
                          </span>
                        )}
                        <span className={cn("text-xs font-medium", s.color)}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
