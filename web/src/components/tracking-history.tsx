"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { formatDateTR } from "@/lib/date";
import { reportError } from "@/lib/error-reporting";
import type { TrackingMeasurement } from "@/lib/tracking";
import { getBPStatus } from "@/lib/tracking";
import { cn } from "@/lib/utils";

interface TrackingHistoryProps {
  type: "weight" | "blood_pressure";
  accessLevel: string | null;
}

export function TrackingHistory({ type, accessLevel }: TrackingHistoryProps) {
  const { activeProfileId } = useActiveProfile();
  const { addToast } = useToast();

  const [measurements, setMeasurements] = useState<TrackingMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    weightKg: "",
    systolic: "",
    diastolic: "",
    pulse: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = accessLevel === "owner" || accessLevel === "editor";

  useEffect(() => {
    async function fetchMeasurements() {
      if (!activeProfileId) return;

      try {
        setLoading(true);
        const res = await fetch(
          `/api/tracking?profileId=${activeProfileId}&type=${type}&limit=200`,
        );
        if (!res.ok) throw new Error("Veriler yüklenemedi");
        const data = await res.json();
        setMeasurements(data.measurements || []);
      } catch (err) {
        reportError(err, { op: "trackingHistory.fetch", type });
        setError("Veriler yüklenirken bir hata oluştu");
      } finally {
        setLoading(false);
      }
    }

    fetchMeasurements();
  }, [activeProfileId, type]);

  function startEditing(m: TrackingMeasurement) {
    setEditingId(m.id);
    setEditForm({
      weightKg: m.weight_kg != null ? String(m.weight_kg) : "",
      systolic: m.systolic != null ? String(m.systolic) : "",
      diastolic: m.diastolic != null ? String(m.diastolic) : "",
      pulse: m.pulse != null ? String(m.pulse) : "",
      notes: m.notes ?? "",
    });
  }

  function cancelEditing() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (type === "weight") {
      const v = parseFloat(editForm.weightKg);
      if (!editForm.weightKg.trim() || isNaN(v) || v < 1 || v > 500) {
        addToast({
          message: "Geçerli bir kilo değeri girin (1-500)",
          type: "error",
        });
        return;
      }
    }
    if (type === "blood_pressure") {
      const s = parseFloat(editForm.systolic);
      const d = parseFloat(editForm.diastolic);
      if (isNaN(s) || s < 50 || s > 300 || isNaN(d) || d < 20 || d > 200) {
        addToast({
          message: "Geçerli tansiyon değerleri girin",
          type: "error",
        });
        return;
      }
      if (editForm.pulse.trim()) {
        const p = parseFloat(editForm.pulse);
        if (isNaN(p) || p < 20 || p > 250) {
          addToast({
            message: "Geçerli bir nabız değeri girin (20-250)",
            type: "error",
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        notes: editForm.notes || null,
      };
      if (type === "weight") {
        body.weightKg = parseFloat(editForm.weightKg);
      } else {
        body.systolic = parseFloat(editForm.systolic);
        body.diastolic = parseFloat(editForm.diastolic);
        body.pulse = editForm.pulse.trim() ? parseFloat(editForm.pulse) : null;
      }

      const res = await fetch(`/api/tracking/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Kaydetme başarısız");

      const data = await res.json();
      setMeasurements((prev) =>
        prev.map((m) => (m.id === id ? data.measurement : m)),
      );
      setEditingId(null);
      addToast({ message: "Güncellendi", type: "success" });
    } catch (err) {
      reportError(err, { op: "trackingHistory.save", id });
      addToast({ message: "Kaydetme başarısız", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tracking/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme başarısız");

      setMeasurements((prev) => prev.filter((m) => m.id !== id));
      setDeletingId(null);
      addToast({ message: "Kayıt silindi", type: "success" });
    } catch (err) {
      reportError(err, { op: "trackingHistory.delete", id });
      addToast({ message: "Silme başarısız", type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  function updateField(field: keyof typeof editForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  // --- Shared sub-components to reduce duplication across weight/BP layouts ---

  function DeleteConfirm({ id }: { id: string }) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-status-critical">Sil?</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-status-critical hover:text-status-critical"
          onClick={() => confirmDelete(id)}
          disabled={deleting}
        >
          {deleting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Onayla
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => setDeletingId(null)}
        >
          İptal
        </Button>
      </div>
    );
  }

  function EditDeleteActions({
    measurement,
    iconSize = "h-3.5 w-3.5",
    buttonSize = "h-8 w-8",
  }: {
    measurement: TrackingMeasurement;
    iconSize?: string;
    buttonSize?: string;
  }) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={buttonSize}
          onClick={() => startEditing(measurement)}
          aria-label="Düzenle"
        >
          <Pencil className={iconSize} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            buttonSize,
            "text-muted-foreground hover:text-status-critical",
          )}
          onClick={() => setDeletingId(measurement.id)}
          aria-label="Sil"
        >
          <Trash2 className={iconSize} />
        </Button>
      </div>
    );
  }

  function SaveCancelIcons({ id }: { id: string }) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => saveEdit(id)}
          disabled={saving}
          aria-label="Kaydet"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-status-normal" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={cancelEditing}
          aria-label="İptal"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  function MobileSaveCancelButtons({ id }: { id: string }) {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => saveEdit(id)}
          disabled={saving}
          className="flex-1"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
          ) : (
            <Check aria-hidden="true" className="h-4 w-4 mr-1.5" />
          )}
          Kaydet
        </Button>
        <Button variant="outline" size="sm" onClick={cancelEditing}>
          İptal
        </Button>
      </div>
    );
  }

  function NotesInput({ className }: { className?: string }) {
    return (
      <Input
        value={editForm.notes}
        onChange={updateField("notes")}
        className={cn("h-8 text-sm", className)}
        placeholder="—"
        aria-label="Not"
      />
    );
  }

  // --- Loading / error / empty states ---

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-8"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Yükleniyor…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-status-critical py-4">{error}</p>;
  }

  if (measurements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">Henüz kayıt yok.</p>
    );
  }

  // --- Weight ---

  if (type === "weight") {
    return (
      <>
        {/* Desktop */}
        <div className="hidden md:block border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Tarih</th>
                <th className="text-right p-3 font-medium">Kilo (kg)</th>
                <th className="text-left p-3 font-medium">Not</th>
                {canEdit && (
                  <th className="text-right p-3 font-medium">
                    <span className="sr-only">İşlemler</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {measurements.map((m) => {
                const isEditing = editingId === m.id;
                const isDeleting = deletingId === m.id;

                return (
                  <tr key={m.id} className="border-t hover:bg-muted/50">
                    {isEditing ? (
                      <>
                        <td className="p-3 text-muted-foreground">
                          {formatDateTR(m.measured_at)}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={editForm.weightKg}
                            onChange={updateField("weightKg")}
                            className="h-8 text-sm text-right w-24 ml-auto"
                            aria-label="Kilo"
                          />
                        </td>
                        <td className="p-2">
                          <NotesInput className="w-full" />
                        </td>
                        <td className="p-2">
                          <SaveCancelIcons id={m.id} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3">{formatDateTR(m.measured_at)}</td>
                        <td className="p-3 text-right tabular-nums font-medium">
                          {m.weight_kg}
                        </td>
                        <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                          {m.notes || "—"}
                        </td>
                        {canEdit && (
                          <td className="p-3 text-right">
                            {isDeleting ? (
                              <div className="flex justify-end">
                                <DeleteConfirm id={m.id} />
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <EditDeleteActions measurement={m} />
                              </div>
                            )}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-2">
          {measurements.map((m) => {
            const isEditing = editingId === m.id;
            const isDeleting = deletingId === m.id;

            return (
              <div key={m.id} className="border rounded-lg p-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {formatDateTR(m.measured_at)}
                    </p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Kilo (kg)
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={editForm.weightKg}
                          onChange={updateField("weightKg")}
                          className="h-8 text-sm"
                          aria-label="Kilo"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Not
                        </label>
                        <NotesInput />
                      </div>
                    </div>
                    <MobileSaveCancelButtons id={m.id} />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTR(m.measured_at)}
                      </span>
                      {canEdit && !isDeleting && (
                        <EditDeleteActions
                          measurement={m}
                          iconSize="h-3 w-3"
                          buttonSize="h-7 w-7"
                        />
                      )}
                    </div>
                    <p className="text-lg tabular-nums font-medium mt-1">
                      {m.weight_kg}{" "}
                      <span className="text-sm text-muted-foreground font-normal">
                        kg
                      </span>
                    </p>
                    {m.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.notes}
                      </p>
                    )}
                    {isDeleting && (
                      <div className="mt-2 pt-2 border-t">
                        <DeleteConfirm id={m.id} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // --- Blood pressure ---

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Tarih</th>
              <th className="text-right p-3 font-medium">Sistolik/Diastolik</th>
              <th className="text-right p-3 font-medium">Nabız</th>
              <th className="text-left p-3 font-medium">Not</th>
              {canEdit && (
                <th className="text-right p-3 font-medium">
                  <span className="sr-only">İşlemler</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {measurements.map((m) => {
              const isEditing = editingId === m.id;
              const isDeleting = deletingId === m.id;
              const bpStatus =
                m.systolic != null && m.diastolic != null
                  ? getBPStatus(m.systolic, m.diastolic)
                  : null;

              return (
                <tr
                  key={m.id}
                  className={cn(
                    "border-t hover:bg-muted/50",
                    bpStatus && bpStatus.label !== "Normal" && bpStatus.bg,
                  )}
                >
                  {isEditing ? (
                    <>
                      <td className="p-3 text-muted-foreground">
                        {formatDateTR(m.measured_at)}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1 justify-end">
                          <Input
                            type="number"
                            value={editForm.systolic}
                            onChange={updateField("systolic")}
                            className="h-8 text-sm text-right w-20"
                            aria-label="Sistolik"
                          />
                          <span className="text-muted-foreground">/</span>
                          <Input
                            type="number"
                            value={editForm.diastolic}
                            onChange={updateField("diastolic")}
                            className="h-8 text-sm text-right w-20"
                            aria-label="Diastolik"
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={editForm.pulse}
                          onChange={updateField("pulse")}
                          className="h-8 text-sm text-right w-20 ml-auto"
                          placeholder="—"
                          aria-label="Nabız"
                        />
                      </td>
                      <td className="p-2">
                        <NotesInput className="w-full" />
                      </td>
                      <td className="p-2">
                        <SaveCancelIcons id={m.id} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3">{formatDateTR(m.measured_at)}</td>
                      <td
                        className={cn(
                          "p-3 text-right tabular-nums font-medium",
                          bpStatus?.color,
                        )}
                      >
                        {m.systolic}/{m.diastolic}
                        {bpStatus && bpStatus.label !== "Normal" && (
                          <span
                            className={cn(
                              "ml-2 text-xs font-normal",
                              bpStatus.color,
                            )}
                          >
                            {bpStatus.label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {m.pulse ?? "—"}
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                        {m.notes || "—"}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-right">
                          {isDeleting ? (
                            <div className="flex justify-end">
                              <DeleteConfirm id={m.id} />
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <EditDeleteActions measurement={m} />
                            </div>
                          )}
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {measurements.map((m) => {
          const isEditing = editingId === m.id;
          const isDeleting = deletingId === m.id;
          const bpStatus =
            m.systolic != null && m.diastolic != null
              ? getBPStatus(m.systolic, m.diastolic)
              : null;

          return (
            <div
              key={m.id}
              className={cn(
                "border rounded-lg p-3",
                bpStatus &&
                  bpStatus.label !== "Normal" &&
                  `${bpStatus.bg} ${bpStatus.borderColor} border-l-2`,
              )}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTR(m.measured_at)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Sistolik
                      </label>
                      <Input
                        type="number"
                        value={editForm.systolic}
                        onChange={updateField("systolic")}
                        className="h-8 text-sm"
                        aria-label="Sistolik"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Diastolik
                      </label>
                      <Input
                        type="number"
                        value={editForm.diastolic}
                        onChange={updateField("diastolic")}
                        className="h-8 text-sm"
                        aria-label="Diastolik"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Nabız
                      </label>
                      <Input
                        type="number"
                        value={editForm.pulse}
                        onChange={updateField("pulse")}
                        className="h-8 text-sm"
                        placeholder="—"
                        aria-label="Nabız"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Not
                      </label>
                      <NotesInput />
                    </div>
                  </div>
                  <MobileSaveCancelButtons id={m.id} />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTR(m.measured_at)}
                    </span>
                    {canEdit && !isDeleting && (
                      <EditDeleteActions
                        measurement={m}
                        iconSize="h-3 w-3"
                        buttonSize="h-7 w-7"
                      />
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span
                      className={cn(
                        "text-lg tabular-nums font-medium",
                        bpStatus?.color,
                      )}
                    >
                      {m.systolic}/{m.diastolic}
                    </span>
                    {m.pulse != null && (
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {m.pulse} bpm
                      </span>
                    )}
                    {bpStatus && bpStatus.label !== "Normal" && (
                      <span className={cn("text-xs ml-auto", bpStatus.color)}>
                        {bpStatus.label}
                      </span>
                    )}
                  </div>
                  {m.notes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {m.notes}
                    </p>
                  )}
                  {isDeleting && (
                    <div className="mt-2 pt-2 border-t">
                      <DeleteConfirm id={m.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
