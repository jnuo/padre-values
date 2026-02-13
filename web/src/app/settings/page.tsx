"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  FileText,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrackingHistory } from "@/components/tracking-history";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { formatDateTR, formatDateTimeTR } from "@/lib/date";
import { reportError } from "@/lib/error-reporting";

type Tab = "tahliller" | "kilo" | "tansiyon";

const TABS: { key: Tab; label: string }[] = [
  { key: "tahliller", label: "Tahliller" },
  { key: "kilo", label: "Kilo" },
  { key: "tansiyon", label: "Tansiyon" },
];

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
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProfile, activeProfileId } = useActiveProfile();

  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab =
    tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : "tahliller";

  function setActiveTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }

  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [filesFetched, setFilesFetched] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("sample_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;

      const comparison =
        new Date(aValue).getTime() - new Date(bValue).getTime();
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [files, sortColumn, sortDirection]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  }

  function SortIcon({ column }: { column: SortColumn }): React.ReactElement {
    if (sortColumn !== column) {
      return (
        <ArrowUpDown
          aria-hidden="true"
          className="h-4 w-4 ml-1 opacity-30 group-hover:opacity-60 transition-opacity"
        />
      );
    }
    if (sortDirection === "asc") {
      return <ArrowUp aria-hidden="true" className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown aria-hidden="true" className="h-4 w-4 ml-1" />;
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
    if (activeTab !== "tahliller" || !activeProfileId || filesFetched) return;

    async function fetchFiles() {
      try {
        setFilesLoading(true);
        const response = await fetch(
          `/api/settings/files?profileId=${activeProfileId}`,
        );

        if (!response.ok) {
          throw new Error("Dosyalar yüklenemedi");
        }

        const data = await response.json();
        setFiles(data.files || []);
        setFilesFetched(true);
      } catch (err) {
        reportError(err, {
          op: "settings.fetchFiles",
          profileId: activeProfileId,
        });
        setFilesError("Dosyalar yüklenirken bir hata oluştu");
      } finally {
        setFilesLoading(false);
      }
    }

    fetchFiles();
  }, [activeProfileId, activeTab, filesFetched]);

  const accessLevel = activeProfile?.access_level ?? null;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "tahliller" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText aria-hidden="true" className="h-5 w-5" />
              Yüklenen Dosyalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filesLoading ? (
              <div
                className="flex items-center justify-center py-8"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="sr-only">Yükleniyor…</span>
              </div>
            ) : filesError ? (
              <p className="text-sm text-status-critical py-4">{filesError}</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Henüz yüklenmiş dosya yok.
              </p>
            ) : (
              <>
                {/* Desktop table view */}
                <div className="hidden md:block border rounded-lg overflow-hidden">
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
                        <th className="text-right p-3 font-medium">
                          <span className="sr-only">İşlemler</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFiles.map((file) => (
                        <tr
                          key={file.id}
                          className="border-t hover:bg-muted/50"
                        >
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
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium tabular-nums">
                              {file.metric_count}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              href={`/settings/files/${file.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Değerleri Gör
                              <ChevronRight
                                aria-hidden="true"
                                className="h-4 w-4"
                              />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleSort("sample_date")}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        sortColumn === "sample_date"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Tahlil Tarihi{" "}
                      {sortColumn === "sample_date" &&
                        (sortDirection === "desc" ? "↓" : "↑")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort("created_at")}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        sortColumn === "created_at"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Yüklenme{" "}
                      {sortColumn === "created_at" &&
                        (sortDirection === "desc" ? "↓" : "↑")}
                    </button>
                  </div>
                  {sortedFiles.map((file) => (
                    <Link
                      key={file.id}
                      href={`/settings/files/${file.id}`}
                      className="flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="font-medium text-sm truncate"
                            title={file.file_name}
                          >
                            {file.file_name}
                          </p>
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium tabular-nums shrink-0">
                            {file.metric_count}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          {file.sample_date ? (
                            <span>
                              Tahlil: {formatDateTR(file.sample_date)}
                            </span>
                          ) : (
                            <span>Tahlil tarihi yok</span>
                          )}
                          <span>·</span>
                          <span>{formatDateTimeTR(file.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 text-muted-foreground shrink-0"
                      />
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "kilo" && (
        <TrackingHistory type="weight" accessLevel={accessLevel} />
      )}

      {activeTab === "tansiyon" && (
        <TrackingHistory type="blood_pressure" accessLevel={accessLevel} />
      )}
    </div>
  );
}
