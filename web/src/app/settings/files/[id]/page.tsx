"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, FileText, Loader2, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatDateTimeTR } from "@/lib/date";

const EMPTY_FORM = { value: "", unit: "", ref_low: "", ref_high: "" };

function checkOutOfRange(
  value: number | string | null,
  refLow: number | string | null,
  refHigh: number | string | null,
): boolean {
  if (value == null) return false;
  const v = Number(value);
  if (isNaN(v)) return false;
  if (refLow != null && !isNaN(Number(refLow)) && v < Number(refLow))
    return true;
  if (refHigh != null && !isNaN(Number(refHigh)) && v > Number(refHigh))
    return true;
  return false;
}

interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
  sample_date: string;
  report_id: string;
}

interface FileData {
  id: string;
  file_name: string;
  created_at: string;
  profile_id: string;
}

export default function FileDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileData | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    value: "",
    unit: "",
    ref_low: "",
    ref_high: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchFileDetails() {
      try {
        setLoading(true);
        const response = await fetch(`/api/settings/files/${fileId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Dosya bulunamadı");
          }
          throw new Error("Dosya detayları yüklenemedi");
        }

        const data = await response.json();
        setFile(data.file);
        setMetrics(data.metrics || []);
      } catch (err) {
        console.error("Failed to fetch file details:", err);
        setError(err instanceof Error ? err.message : "Bir hata oluştu");
      } finally {
        setLoading(false);
      }
    }

    if (fileId) {
      fetchFileDetails();
    }
  }, [fileId]);

  // Format reference range: "100 - 200", "≥ 100", "≤ 200", or "-"
  function formatRefRange(low: number | null, high: number | null): string {
    if (low != null && high != null) return `${low} - ${high}`;
    if (low != null) return `≥ ${low}`;
    if (high != null) return `≤ ${high}`;
    return "-";
  }

  function startEditing(metric: Metric): void {
    setEditingId(metric.id);
    setEditForm({
      value: String(metric.value),
      unit: metric.unit ?? "",
      ref_low: metric.ref_low != null ? String(metric.ref_low) : "",
      ref_high: metric.ref_high != null ? String(metric.ref_high) : "",
    });
  }

  function cancelEditing(): void {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  const saveMetric = async (metricId: string) => {
    // Validate value is not empty
    const parsedValue = parseFloat(editForm.value);
    if (!editForm.value.trim() || isNaN(parsedValue)) {
      addToast({ message: "Değer boş olamaz", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/settings/files/${fileId}/metrics`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricId,
          value: parseFloat(editForm.value),
          unit: editForm.unit || null,
          ref_low: editForm.ref_low ? parseFloat(editForm.ref_low) : null,
          ref_high: editForm.ref_high ? parseFloat(editForm.ref_high) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Kaydetme başarısız");
      }

      // Update local state
      setMetrics((prev) =>
        prev.map((m) =>
          m.id === metricId
            ? {
                ...m,
                value: parseFloat(editForm.value),
                unit: editForm.unit || null,
                ref_low: editForm.ref_low ? parseFloat(editForm.ref_low) : null,
                ref_high: editForm.ref_high
                  ? parseFloat(editForm.ref_high)
                  : null,
              }
            : m,
        ),
      );

      setEditingId(null);
      addToast({ message: "Metrik güncellendi", type: "success" });
    } catch (err) {
      console.error("Failed to save metric:", err);
      addToast({ message: "Kaydetme başarısız", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">Yükleniyor…</span>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4 mr-1" />
            Geri
          </Button>
        </div>
        <p className="text-status-critical">{error || "Dosya bulunamadı"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4 mr-1" />
          Geri
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="truncate">{file.file_name}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {formatDateTimeTR(file.created_at)}
          </p>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Bu dosyada metrik bulunamadı.
            </p>
          ) : (
            <>
              {/* Desktop table view */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-medium">Test Adı</th>
                        <th className="text-right p-3 font-medium">Değer</th>
                        <th className="text-right p-3 font-medium">Birim</th>
                        <th className="text-right p-3 font-medium">Referans</th>
                        <th className="w-24">
                          <span className="sr-only">İşlemler</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric) => {
                        const isOutOfRange = checkOutOfRange(
                          metric.value,
                          metric.ref_low,
                          metric.ref_high,
                        );
                        return (
                          <tr
                            key={metric.id}
                            className={cn(
                              "border-t hover:bg-muted/50",
                              isOutOfRange &&
                                "bg-status-critical/10 hover:bg-status-critical/15",
                            )}
                          >
                            {editingId === metric.id ? (
                              <>
                                <td className="p-3 font-medium">
                                  {metric.name}
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    value={editForm.value}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        value: e.target.value,
                                      }))
                                    }
                                    className="h-8 text-sm text-right w-24"
                                    aria-label="Değer"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={editForm.unit}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        unit: e.target.value,
                                      }))
                                    }
                                    className="h-8 text-sm text-right w-20"
                                    placeholder="-"
                                    aria-label="Birim"
                                  />
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-1 justify-end">
                                    <Input
                                      type="number"
                                      value={editForm.ref_low}
                                      onChange={(e) =>
                                        setEditForm((prev) => ({
                                          ...prev,
                                          ref_low: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-sm text-right w-16"
                                      placeholder="Min"
                                      aria-label="Referans minimum"
                                    />
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                    <Input
                                      type="number"
                                      value={editForm.ref_high}
                                      onChange={(e) =>
                                        setEditForm((prev) => ({
                                          ...prev,
                                          ref_high: e.target.value,
                                        }))
                                      }
                                      className="h-8 text-sm text-right w-16"
                                      placeholder="Max"
                                      aria-label="Referans maksimum"
                                    />
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => saveMetric(metric.id)}
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
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3 font-medium">
                                  {metric.name}
                                </td>
                                <td
                                  className={cn(
                                    "p-3 text-right tabular-nums",
                                    isOutOfRange &&
                                      "text-status-critical font-medium",
                                  )}
                                >
                                  {metric.value}
                                </td>
                                <td className="p-3 text-right text-muted-foreground">
                                  {metric.unit || "-"}
                                </td>
                                <td className="p-3 text-right text-muted-foreground">
                                  {formatRefRange(
                                    metric.ref_low,
                                    metric.ref_high,
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditing(metric)}
                                    className="gap-1"
                                  >
                                    <Pencil
                                      aria-hidden="true"
                                      className="h-3 w-3"
                                    />
                                    Düzenle
                                  </Button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile card view */}
              <div className="md:hidden space-y-2">
                {metrics.map((metric) => {
                  const isOutOfRange = checkOutOfRange(
                    metric.value,
                    metric.ref_low,
                    metric.ref_high,
                  );
                  const isEditing = editingId === metric.id;

                  return (
                    <div
                      key={metric.id}
                      className={cn(
                        "border rounded-lg p-3",
                        isOutOfRange &&
                          "bg-status-critical/10 border-status-critical/20",
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <p className="font-medium text-sm">{metric.name}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                Değer
                              </label>
                              <Input
                                type="number"
                                value={editForm.value}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    value: e.target.value,
                                  }))
                                }
                                className="h-8 text-sm"
                                aria-label="Değer"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                Birim
                              </label>
                              <Input
                                value={editForm.unit}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    unit: e.target.value,
                                  }))
                                }
                                className="h-8 text-sm"
                                placeholder="-"
                                aria-label="Birim"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                Ref. Min
                              </label>
                              <Input
                                type="number"
                                value={editForm.ref_low}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    ref_low: e.target.value,
                                  }))
                                }
                                className="h-8 text-sm"
                                placeholder="-"
                                aria-label="Referans minimum"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">
                                Ref. Max
                              </label>
                              <Input
                                type="number"
                                value={editForm.ref_high}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    ref_high: e.target.value,
                                  }))
                                }
                                className="h-8 text-sm"
                                placeholder="-"
                                aria-label="Referans maksimum"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveMetric(metric.id)}
                              disabled={saving}
                              className="flex-1"
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                              ) : (
                                <Check
                                  aria-hidden="true"
                                  className="h-4 w-4 mr-1.5"
                                />
                              )}
                              Kaydet
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEditing}
                            >
                              İptal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => startEditing(metric)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">
                              {metric.name}
                            </span>
                            <Pencil
                              aria-hidden="true"
                              className="h-3 w-3 text-muted-foreground shrink-0"
                            />
                          </div>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span
                              className={cn(
                                "text-lg tabular-nums",
                                isOutOfRange &&
                                  "text-status-critical font-medium",
                              )}
                            >
                              {metric.value}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {metric.unit || ""}
                            </span>
                            {(metric.ref_low != null ||
                              metric.ref_high != null) && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                Ref:{" "}
                                {formatRefRange(
                                  metric.ref_low,
                                  metric.ref_high,
                                )}
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
