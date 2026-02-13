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
import { Loader2, Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatTrackingDate, type TrackingMeasurement } from "@/lib/tracking";

interface AddWeightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
  recentMeasurements?: TrackingMeasurement[];
  onSaved?: () => void;
}

export function AddWeightDialog({
  open,
  onOpenChange,
  profileId,
  profileName,
  recentMeasurements = [],
  onSaved,
}: AddWeightDialogProps) {
  const { addToast } = useToast();
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const weightNum = parseFloat(weight.replace(",", "."));
  const hasValidInput = !isNaN(weightNum) && weightNum > 0;

  const recent = recentMeasurements
    .filter((m) => m.type === "weight")
    .slice(0, 3);
  const lastWeight = recent[0]?.weight_kg ? Number(recent[0].weight_kg) : null;
  const diff = hasValidInput && lastWeight ? weightNum - lastWeight : null;

  async function handleSave() {
    if (!hasValidInput) return;
    setSaving(true);

    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          type: "weight",
          weightKg: weightNum,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Kayıt başarısız");
      }

      addToast({ type: "success", message: "Kilo kaydedildi", duration: 3000 });
      setWeight("");
      setNotes("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Kilo Ekle
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{profileName}</span>{" "}
            için ölçüm ekliyorsunuz
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Weight Input */}
          <div className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label
                  htmlFor="weight"
                  className="text-xs text-muted-foreground"
                >
                  Kilo
                </Label>
                <Input
                  id="weight"
                  type="text"
                  inputMode="decimal"
                  placeholder="82.5"
                  value={weight}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) {
                      setWeight(v);
                    }
                  }}
                  className="h-14 text-2xl font-semibold text-center tabular-nums"
                  autoFocus
                />
              </div>
              <span className="text-sm text-muted-foreground pb-4">kg</span>
            </div>

            {/* Trend indicator */}
            {diff !== null && (
              <div
                className={cn(
                  "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors",
                  diff > 0
                    ? "bg-status-warning/10 text-status-warning"
                    : diff < 0
                      ? "bg-status-normal/10 text-status-normal"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {diff > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : diff < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {diff > 0 ? "+" : ""}
                {diff.toFixed(1)} kg son ölçümden
              </div>
            )}
          </div>

          {/* Notes (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">
              Not (isteğe bağlı)
            </Label>
            <Input
              id="notes"
              type="text"
              placeholder="Sabah aç karnına…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10"
            />
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
                {recent.map((m, i) => {
                  const w = Number(m.weight_kg);
                  const prev = recent[i + 1]?.weight_kg
                    ? Number(recent[i + 1].weight_kg)
                    : null;
                  const d = prev !== null ? w - prev : null;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/50"
                    >
                      <span className="text-muted-foreground text-xs">
                        {formatTrackingDate(m.measured_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">
                          {w.toFixed(1)} kg
                        </span>
                        {d !== null && (
                          <span
                            className={cn(
                              "text-xs tabular-nums",
                              d > 0
                                ? "text-status-warning"
                                : d < 0
                                  ? "text-status-normal"
                                  : "text-muted-foreground",
                            )}
                          >
                            {d > 0 ? "+" : ""}
                            {d.toFixed(1)}
                          </span>
                        )}
                        {m.notes && (
                          <span className="text-xs text-muted-foreground truncate max-w-24">
                            {m.notes}
                          </span>
                        )}
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
