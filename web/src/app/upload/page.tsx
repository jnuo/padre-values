"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Loader2,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import { ExtractionLoading } from "@/components/extraction-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/header";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  display_name: string;
}

interface ExtractedMetric {
  name: string;
  value: number;
  unit?: string;
  ref_low?: number | null;
  ref_high?: number | null;
}

interface ExtractedData {
  sample_date: string | null;
  metrics: ExtractedMetric[];
}

type UploadStatus =
  | "idle"
  | "uploading"
  | "extracting"
  | "review"
  | "confirming"
  | "success"
  | "error";

function UploadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    null,
  );
  const [editedMetrics, setEditedMetrics] = useState<ExtractedMetric[]>([]);
  const [sampleDate, setSampleDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for pending uploads and resume state
  useEffect(() => {
    async function checkPendingUploads() {
      try {
        // Check URL for specific uploadId
        const urlUploadId = searchParams.get("uploadId");

        // Fetch pending uploads
        const response = await fetch("/api/upload");
        if (!response.ok) return;

        const data = await response.json();
        const uploads = data.uploads || [];

        // Find the relevant upload (from URL or most recent)
        let pendingUpload = urlUploadId
          ? uploads.find((u: { id: string }) => u.id === urlUploadId)
          : uploads[0];

        if (pendingUpload) {
          setUploadId(pendingUpload.id);
          setFileName(pendingUpload.file_name);
          setSelectedProfileId(pendingUpload.profile_id);

          if (pendingUpload.status === "extracting") {
            setStatus("extracting");
            // Poll for completion
            startPolling(pendingUpload.id);
          } else if (pendingUpload.status === "review") {
            // Fetch extracted data
            await loadExtractedData(pendingUpload.id);
          } else if (pendingUpload.status === "pending") {
            // Extraction not started yet, start it
            setStatus("extracting");
            startExtraction(pendingUpload.id);
          }
        }
      } catch (error) {
        console.error("Failed to check pending uploads:", error);
      }
    }

    checkPendingUploads();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [searchParams]);

  // Poll for extraction completion
  const startPolling = (id: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch("/api/upload");
        if (!response.ok) return;

        const data = await response.json();
        const upload = data.uploads?.find((u: { id: string }) => u.id === id);

        if (upload?.status === "review") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          await loadExtractedData(id);
        } else if (upload?.status === "pending" && upload?.error_message) {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          setError(upload.error_message);
          setStatus("error");
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);
  };

  // Load extracted data for review
  const loadExtractedData = async (id: string) => {
    try {
      const response = await fetch(`/api/upload/${id}`);
      if (!response.ok) throw new Error("Failed to load upload data");

      const data = await response.json();
      const upload = data.upload;

      if (upload?.extracted_data) {
        const extracted = upload.extracted_data;
        setExtractedData(extracted);
        setEditedMetrics(extracted.metrics || []);
        setSampleDate(extracted.sample_date || upload.sample_date || "");
        setStatus("review");
      }
    } catch (error) {
      console.error("Failed to load extracted data:", error);
      setError("Veri yüklenemedi");
      setStatus("error");
    }
  };

  // Start extraction for a pending upload
  const startExtraction = async (id: string) => {
    try {
      const response = await fetch(`/api/upload/${id}/extract`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Extraction failed");
      }

      const data = await response.json();
      setExtractedData(data.extractedData);
      setEditedMetrics(data.extractedData.metrics || []);
      setSampleDate(data.extractedData.sample_date || "");
      setStatus("review");
    } catch (error) {
      console.error("Extraction error:", error);
      setError(String(error));
      setStatus("error");
    }
  };

  // Fetch profiles on mount and auto-select active profile
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const response = await fetch("/api/profiles");
        if (response.ok) {
          const data = await response.json();
          const fetchedProfiles = data.profiles || [];
          setProfiles(fetchedProfiles);

          // Read active profile from cookie
          const cookies = document.cookie.split(";");
          const activeProfileCookie = cookies.find((c) =>
            c.trim().startsWith("viziai_active_profile="),
          );
          const cookieProfileId = activeProfileCookie?.split("=")[1]?.trim();

          // Use cookie profile if valid, otherwise first profile
          if (
            cookieProfileId &&
            fetchedProfiles.some((p: Profile) => p.id === cookieProfileId)
          ) {
            setSelectedProfileId(cookieProfileId);
          } else if (fetchedProfiles.length > 0) {
            setSelectedProfileId(fetchedProfiles[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch profiles:", error);
      }
    }

    fetchProfiles();
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!selectedProfileId) {
        setError("Lütfen bir profil seçin");
        return;
      }

      if (file.type !== "application/pdf") {
        setError("Sadece PDF dosyaları kabul edilir");
        return;
      }

      setError(null);
      setFileName(file.name);
      setStatus("uploading");

      try {
        // Upload the file
        const formData = new FormData();
        formData.append("file", file);
        formData.append("profileId", selectedProfileId);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok) {
          if (uploadResponse.status === 409) {
            setError(
              `Bu dosya zaten yüklenmiş: ${uploadData.existingSampleDate || "tarih bilinmiyor"}`,
            );
          } else {
            setError(uploadData.message || "Yükleme başarısız");
          }
          setStatus("error");
          return;
        }

        setUploadId(uploadData.uploadId);
        setStatus("extracting");

        // Start extraction
        const extractResponse = await fetch(
          `/api/upload/${uploadData.uploadId}/extract`,
          {
            method: "POST",
          },
        );

        const extractData = await extractResponse.json();

        if (!extractResponse.ok) {
          setError(extractData.message || "Veri çıkarma başarısız");
          setStatus("error");
          return;
        }

        // Set extracted data for review
        setExtractedData(extractData.extractedData);
        setEditedMetrics(extractData.extractedData.metrics || []);
        setSampleDate(extractData.extractedData.sample_date || "");
        setStatus("review");
      } catch (err) {
        console.error("Upload error:", err);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setStatus("error");
      }
    },
    [selectedProfileId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: status !== "idle" && status !== "error",
  });

  const handleMetricChange = (
    index: number,
    field: keyof ExtractedMetric,
    value: string | number | null,
  ) => {
    const updated = [...editedMetrics];
    updated[index] = { ...updated[index], [field]: value };
    setEditedMetrics(updated);
  };

  const handleRemoveMetric = (index: number) => {
    setEditedMetrics(editedMetrics.filter((_, i) => i !== index));
  };

  const handleConfirm = async () => {
    if (!uploadId || !sampleDate || editedMetrics.length === 0) return;

    setStatus("confirming");
    setError(null);

    try {
      const response = await fetch(`/api/upload/${uploadId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleDate,
          metrics: editedMetrics,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Onaylama başarısız");
        setStatus("review");
        return;
      }

      setStatus("success");
    } catch (err) {
      console.error("Confirm error:", err);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setStatus("review");
    }
  };

  const handleCancel = async () => {
    if (uploadId) {
      try {
        await fetch(`/api/upload/${uploadId}`, { method: "DELETE" });
      } catch (err) {
        console.error("Cancel error:", err);
      }
    }

    // Reset state
    setStatus("idle");
    setUploadId(null);
    setFileName("");
    setExtractedData(null);
    setEditedMetrics([]);
    setSampleDate("");
    setError(null);
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="min-h-screen bg-background">
      <Header
        profileName={selectedProfile?.display_name}
        currentProfileId={selectedProfileId || undefined}
      />

      <main className="container max-w-3xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Geri
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tahlil Raporu Yükle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Selection */}
            {status === "idle" && (
              <div className="space-y-2">
                <Label htmlFor="profile">Profil</Label>
                <Select
                  value={selectedProfileId}
                  onValueChange={setSelectedProfileId}
                >
                  <SelectTrigger id="profile">
                    <SelectValue placeholder="Profil seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Drop Zone */}
            {(status === "idle" || status === "error") && (
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  !selectedProfileId && "opacity-50 cursor-not-allowed",
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg font-medium">
                    PDF dosyasını buraya bırakın
                  </p>
                ) : (
                  <>
                    <p className="text-lg font-medium">
                      PDF dosyasını sürükleyin veya tıklayın
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sadece PDF dosyaları kabul edilir
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Uploading State */}
            {status === "uploading" && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Dosya yükleniyor...</p>
                <p className="text-sm text-muted-foreground">{fileName}</p>
              </div>
            )}

            {/* Extracting State */}
            {status === "extracting" && (
              <ExtractionLoading fileName={fileName || undefined} />
            )}

            {/* Review State */}
            {status === "review" && extractedData && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-status-normal">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{fileName}</span>
                </div>

                {/* Sample Date */}
                <div className="space-y-2">
                  <Label htmlFor="sampleDate">Tahlil Tarihi</Label>
                  <Input
                    id="sampleDate"
                    type="date"
                    value={sampleDate}
                    onChange={(e) => setSampleDate(e.target.value)}
                    className="max-w-xs"
                  />
                </div>

                {/* Metrics Table */}
                <div className="space-y-2">
                  <Label>Metrikler ({editedMetrics.length})</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">
                              Metrik
                            </th>
                            <th className="text-right p-2 font-medium">
                              Değer
                            </th>
                            <th className="text-right p-2 font-medium">
                              Birim
                            </th>
                            <th className="text-right p-2 font-medium">
                              Ref Min
                            </th>
                            <th className="text-right p-2 font-medium">
                              Ref Max
                            </th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editedMetrics.map((metric, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">
                                <Input
                                  value={metric.name}
                                  onChange={(e) =>
                                    handleMetricChange(
                                      index,
                                      "name",
                                      e.target.value,
                                    )
                                  }
                                  className="h-8 text-sm"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={metric.value}
                                  onChange={(e) =>
                                    handleMetricChange(
                                      index,
                                      "value",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 text-sm text-right w-24"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={metric.unit || ""}
                                  onChange={(e) =>
                                    handleMetricChange(
                                      index,
                                      "unit",
                                      e.target.value,
                                    )
                                  }
                                  className="h-8 text-sm text-right w-20"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={metric.ref_low ?? ""}
                                  onChange={(e) =>
                                    handleMetricChange(
                                      index,
                                      "ref_low",
                                      e.target.value
                                        ? parseFloat(e.target.value)
                                        : null,
                                    )
                                  }
                                  className="h-8 text-sm text-right w-20"
                                  placeholder="-"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={metric.ref_high ?? ""}
                                  onChange={(e) =>
                                    handleMetricChange(
                                      index,
                                      "ref_high",
                                      e.target.value
                                        ? parseFloat(e.target.value)
                                        : null,
                                    )
                                  }
                                  className="h-8 text-sm text-right w-20"
                                  placeholder="-"
                                />
                              </td>
                              <td className="p-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveMetric(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={handleCancel}>
                    İptal
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!sampleDate || editedMetrics.length === 0}
                  >
                    Onayla ve Kaydet
                  </Button>
                </div>
              </div>
            )}

            {/* Confirming State */}
            {status === "confirming" && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">Kaydediliyor...</p>
              </div>
            )}

            {/* Success State */}
            {status === "success" && (
              <div className="flex flex-col items-center py-8">
                <div className="h-16 w-16 rounded-full bg-status-normal/10 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-status-normal" />
                </div>
                <p className="text-lg font-medium">Başarıyla Kaydedildi</p>
                <p className="text-sm text-muted-foreground mb-6">
                  Tahlil sonuçları profilinize eklendi
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleCancel}>
                    Başka Dosya Yükle
                  </Button>
                  <Button onClick={handleGoToDashboard}>
                    Dashboard&apos;a Git
                  </Button>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-status-critical/10 text-status-critical rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
