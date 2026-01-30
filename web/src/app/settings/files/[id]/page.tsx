"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, FileText, Loader2, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDateTimeTR } from "@/lib/date";

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

export default function FileDetailPage() {
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

  const EMPTY_FORM = { value: "", unit: "", ref_low: "", ref_high: "" };

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-1" />
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
          <ChevronLeft className="h-4 w-4 mr-1" />
          Geri
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {file.file_name}
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
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Test Adı</th>
                      <th className="text-right p-3 font-medium">Değer</th>
                      <th className="text-right p-3 font-medium">Birim</th>
                      <th className="text-right p-3 font-medium">Referans</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric) => (
                      <tr
                        key={metric.id}
                        className="border-t hover:bg-muted/50"
                      >
                        {editingId === metric.id ? (
                          <>
                            <td className="p-3 font-medium">{metric.name}</td>
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
                                />
                                <span className="text-muted-foreground">-</span>
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
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 font-medium">{metric.name}</td>
                            <td className="p-3 text-right tabular-nums">
                              {metric.value}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {metric.unit || "-"}
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {metric.ref_low != null || metric.ref_high != null
                                ? `${metric.ref_low ?? "-"} - ${metric.ref_high ?? "-"}`
                                : "-"}
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(metric)}
                                className="gap-1"
                              >
                                <Pencil className="h-3 w-3" />
                                Düzenle
                              </Button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
