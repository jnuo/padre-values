"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { formatDateTR, formatDateTimeTR } from "@/lib/date";

type SortColumn = "sample_date" | "created_at";
type SortDirection = "asc" | "desc";

interface ProcessedFile {
  id: string;
  file_name: string;
  created_at: string;
  sample_date: string | null;
  metric_count: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const { activeProfileId } = useActiveProfile();
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("sample_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null values - push them to the end
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      const comparison =
        new Date(aValue).getTime() - new Date(bValue).getTime();
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [files, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  function SortIcon({ column }: { column: SortColumn }): React.ReactElement {
    if (sortColumn !== column) {
      return (
        <ArrowUpDown className="h-4 w-4 ml-1 opacity-30 group-hover:opacity-60 transition-opacity" />
      );
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  }

  function SortableHeader({
    column,
    label,
  }: {
    column: SortColumn;
    label: string;
  }): React.ReactElement {
    const isActive = sortColumn === column;
    const ariaLabel = isActive
      ? `${label} - ${sortDirection === "asc" ? "artan sıra" : "azalan sıra"}`
      : `${label} - sıralanmamış`;

    return (
      <th
        className="text-left p-3 font-medium cursor-pointer hover:bg-muted-foreground/10 select-none group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => handleSort(column)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSort(column);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
      >
        <span className="inline-flex items-center">
          {label}
          <SortIcon column={column} />
        </span>
      </th>
    );
  }

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
                    <SortableHeader
                      column="sample_date"
                      label="Tahlil Tarihi"
                    />
                    <SortableHeader column="created_at" label="Yüklenme" />
                    <th className="text-center p-3 font-medium">Metrik</th>
                    <th className="text-right p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((file) => (
                    <tr key={file.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 max-w-[200px]">
                        <span
                          className="font-medium truncate block"
                          title={file.file_name}
                        >
                          {file.file_name}
                        </span>
                      </td>
                      <td className="p-3">
                        {file.sample_date ? (
                          <span className="font-medium">
                            {formatDateTR(file.sample_date)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDateTimeTR(file.created_at)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {file.metric_count}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/settings/files/${file.id}`)
                          }
                        >
                          Değerleri Gör
                          <ChevronRight className="h-4 w-4 ml-1" />
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
