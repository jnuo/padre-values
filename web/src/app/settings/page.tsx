"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveProfile } from "@/hooks/use-active-profile";

interface ProcessedFile {
  id: string;
  file_name: string;
  created_at: string;
  metric_count: number;
}

// Format date in Turkish: "29 Oca 2025, 10:30"
function formatDateTurkish(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    "Oca",
    "Şub",
    "Mar",
    "Nis",
    "May",
    "Haz",
    "Tem",
    "Ağu",
    "Eyl",
    "Eki",
    "Kas",
    "Ara",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { activeProfileId } = useActiveProfile();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFiles() {
      if (!activeProfileId) return;

      try {
        setLoading(true);
        const response = await fetch(
          `/api/settings/files?profileId=${activeProfileId}`,
        );

        if (!response.ok) {
          throw new Error("Dosyalar yüklenemedi");
        }

        const data = await response.json();
        setFiles(data.files || []);
      } catch (err) {
        console.error("Failed to fetch files:", err);
        setError("Dosyalar yüklenirken bir hata oluştu");
      } finally {
        setLoading(false);
      }
    }

    fetchFiles();
  }, [activeProfileId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dosyalar</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Yüklenen Dosyalar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-status-critical py-4">{error}</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Henüz yüklenmiş dosya yok.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Dosya Adı</th>
                    <th className="text-left p-3 font-medium">
                      Yüklenme Zamanı
                    </th>
                    <th className="text-center p-3 font-medium">Metrik</th>
                    <th className="text-right p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">
                        <span className="font-medium">{file.file_name}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDateTurkish(file.created_at)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {file.metric_count}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/settings/files/${file.id}`)
                          }
                        >
                          Detaylar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
