"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Metric, MetricValue } from "@/lib/sheets";
import { Info, Search, X, ArrowUpDown, GripVertical } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { compareDateAsc, parseToISO, formatTR } from "@/lib/date";
import { MetricChart } from "@/components/metric-chart";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActiveProfile } from "@/hooks/use-active-profile";
import { Header } from "@/components/header";
import { LoadingState, ErrorState } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";

type UserConfig = {
  id: string;
  name: string;
  username: string;
  dataSheetName: string;
  referenceSheetName: string;
};

type ApiData = { metrics: Metric[]; values: MetricValue[] };

type DateRange = "all" | "15" | "30" | "90";

/**
 * Check if a value is within the metric's reference range.
 */
function isValueInRange(
  value: number | undefined,
  refMin: number | null,
  refMax: number | null,
): boolean {
  if (value === undefined) return false;
  const aboveMin = refMin == null || value >= refMin;
  const belowMax = refMax == null || value <= refMax;
  return aboveMin && belowMax;
}

/**
 * Normalize Turkish characters for case-insensitive search.
 */
function normalizeTurkish(str: string): string {
  return str
    .replace(/İ/g, "i") // Turkish uppercase İ → i (must be before toLowerCase)
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

// Deduplicate metrics with different capitalizations
function deduplicateMetrics(data: ApiData): ApiData {
  const metricMap = new Map<string, Metric>();
  const metricIdMapping = new Map<string, string>(); // old ID → canonical ID

  // Group metrics by normalized name
  for (const metric of data.metrics) {
    const normalizedName = normalizeTurkish(metric.name);

    if (!metricMap.has(normalizedName)) {
      // First occurrence - keep it
      metricMap.set(normalizedName, metric);
      metricIdMapping.set(metric.id, metric.id);
    } else {
      // Duplicate found - map this ID to the canonical one
      const canonical = metricMap.get(normalizedName)!;
      metricIdMapping.set(metric.id, canonical.id);
    }
  }

  // Deduplicated metrics
  const deduplicatedMetrics = Array.from(metricMap.values());

  // Remap all values to use canonical metric IDs
  const deduplicatedValues = data.values.map((v) => ({
    ...v,
    metric_id: metricIdMapping.get(v.metric_id) || v.metric_id,
  }));

  return {
    metrics: deduplicatedMetrics,
    values: deduplicatedValues,
  };
}

// Sortable metric item for the sort sheet
function SortableMetricItem({
  id,
  name,
  value,
  unit,
  inRange,
  onSendToTop,
  isFirst,
}: {
  id: string;
  name: string;
  value?: number;
  unit?: string;
  inRange: boolean;
  onSendToTop?: () => void;
  isFirst?: boolean;
}): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, pointerEvents: "auto" }}
      className={cn(
        "group flex items-center gap-2 p-2 border rounded-lg transition-[opacity,transform,box-shadow] relative",
        isDragging
          ? "opacity-40 scale-105 shadow-lg cursor-grabbing"
          : "hover:shadow-sm opacity-100",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
        style={{ touchAction: "none", pointerEvents: "auto" }}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0" style={{ pointerEvents: "none" }}>
        <div className="text-xs text-muted-foreground truncate">{name}</div>
        <div
          className={cn(
            "text-sm font-semibold",
            inRange ? "text-status-normal" : "text-status-critical",
          )}
        >
          {typeof value === "number" ? value.toFixed(1) : "—"}
          {unit && (
            <span className="text-xs ml-0.5 font-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Send to Top Button */}
      {!isFirst && onSendToTop && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSendToTop();
          }}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
            "transition-[opacity,transform,background-color,border-color,color] duration-200 ease-out",
            // Always visible on mobile, hover-only on desktop
            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
            "translate-x-0 sm:translate-x-2 sm:group-hover:translate-x-0",
            "bg-background/80 backdrop-blur-sm",
            "border border-border/50",
            "hover:bg-primary/10 hover:border-primary/30",
            "active:scale-95",
            "text-muted-foreground hover:text-primary",
          )}
          style={{ pointerEvents: "auto" }}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            strokeWidth="2.5"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
            />
          </svg>
          <span className="hidden sm:inline">En üste gönder</span>
        </button>
      )}
    </div>
  );
}

export default function Dashboard(): React.ReactElement | null {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [, setHoveredDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [showAverage, setShowAverage] = useState(false);

  // Multi-profile support
  const {
    activeProfile,
    activeProfileId,
    loading: profileLoading,
    needsOnboarding,
    error: profileError,
  } = useActiveProfile();

  // Redirect to onboarding if no profiles
  useEffect(() => {
    if (needsOnboarding) {
      router.push("/onboarding");
    }
  }, [needsOnboarding, router]);

  // User config - uses active profile
  const [currentUser] = useState<UserConfig>({
    id: "user",
    name: "",
    username: "user",
    dataSheetName: "",
    referenceSheetName: "",
  });
  const hasAutoSelected = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [metricOrder, setMetricOrder] = useState<string[]>([]);

  // Show toast when there's a profile error
  useEffect(() => {
    if (profileError) {
      addToast({
        type: "error",
        message: profileError,
        duration: 5000,
      });
    }
  }, [profileError, addToast]);

  // Load metric order from API on mount
  useEffect(() => {
    if (!currentUser) return;

    async function loadMetricOrder() {
      try {
        const response = await fetch("/api/metric-order");
        if (response.ok) {
          const data = await response.json();
          if (
            data.order &&
            Array.isArray(data.order) &&
            data.order.length > 0
          ) {
            setMetricOrder(data.order);
          }
        }
      } catch (err) {
        console.error("Failed to load metric order:", err);
        addToast({
          type: "error",
          message: "Metrik sıralaması yüklenemedi.",
          duration: 5000,
        });
      }
    }

    loadMetricOrder();
  }, [currentUser]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    // Temporarily disable TouchSensor to test if it's blocking scroll
    // useSensor(TouchSensor, {
    //   activationConstraint: {
    //     distance: 8,
    //   },
    // }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Fetch data from API using active profile
  useEffect(() => {
    // Wait for profile to be loaded
    if (profileLoading || !activeProfileId) {
      return;
    }

    let ignore = false;
    async function load() {
      try {
        // Fetch metrics for the active profile
        const res = await fetch(`/api/metrics?profileId=${activeProfileId}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to load data");
        const json = (await res.json()) as ApiData;

        if (!ignore) {
          setData(json);
          // Initialize metric order if empty
          if (metricOrder.length === 0 && json.metrics.length > 0) {
            setMetricOrder(json.metrics.map((m) => m.id));
          }
        }
      } catch (e: unknown) {
        const errorMessage = (e as Error)?.message ?? "Bilinmeyen hata";
        console.error("Failed to load metrics data:", e);
        if (!ignore) {
          setError(errorMessage);
          addToast({
            type: "error",
            message: `Veriler yüklenemedi: ${errorMessage}`,
            duration: 5000,
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [activeProfileId, profileLoading, addToast]);

  // Auto-select Hemoglobin when data is loaded
  useEffect(() => {
    if (data && !hasAutoSelected.current) {
      const hemoglobinMetric = data.metrics.find((metric) =>
        metric.name.toLowerCase().includes("hemoglobin"),
      );
      if (hemoglobinMetric) {
        setSelectedMetrics([hemoglobinMetric.id]);
        hasAutoSelected.current = true;
      }
    }
  }, [data]);

  // Filter data based on date range
  const filteredData = useMemo(() => {
    if (!data) return { metrics: [], values: [] };

    // First, deduplicate metrics with different capitalizations
    const deduplicated = deduplicateMetrics(data);

    if (dateRange === "all") return deduplicated;

    const days = parseInt(dateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = cutoffDate.toISOString().split("T")[0];

    // Filter values that are within the date range
    const filteredValues = deduplicated.values.filter((v) => {
      const iso = parseToISO(v.date);
      if (!iso) return false;
      return iso >= cutoffString;
    });

    return { ...deduplicated, values: filteredValues };
  }, [data, dateRange]);

  // Sort and filter metrics based on order and search query
  const displayedMetrics = useMemo(() => {
    let metrics = filteredData.metrics;

    // Apply search filter
    if (searchQuery && searchQuery.length > 1) {
      const normalizedQuery = normalizeTurkish(searchQuery);
      metrics = metrics.filter((m) =>
        normalizeTurkish(m.name).includes(normalizedQuery),
      );
    }

    // Apply custom sort order
    if (metricOrder.length > 0) {
      metrics = [...metrics].sort((a, b) => {
        const indexA = metricOrder.indexOf(a.id);
        const indexB = metricOrder.indexOf(b.id);
        // If not in order array, put at end
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    return metrics;
  }, [filteredData.metrics, searchQuery, metricOrder]);

  const valuesByMetric = useMemo(() => {
    if (!filteredData)
      return new Map<string, { date: string; value: number; count: number }>();
    const map = new Map<
      string,
      { date: string; value: number; count: number }
    >();

    // Group values by metric
    const metricGroups = new Map<string, { date: string; value: number }[]>();
    for (const v of filteredData.values) {
      if (!metricGroups.has(v.metric_id)) {
        metricGroups.set(v.metric_id, []);
      }
      const iso = parseToISO(v.date) ?? v.date;
      metricGroups.get(v.metric_id)!.push({ date: iso, value: v.value });
    }

    for (const [metricId, values] of metricGroups) {
      if (values.length === 0) continue;

      if (showAverage) {
        // Calculate average for this metric
        const average =
          values.reduce((sum, val) => sum + val.value, 0) / values.length;
        // Get the latest date for this metric
        const latestEntry = values
          .sort((a, b) => compareDateAsc(a.date, b.date))
          .pop()!;
        map.set(metricId, {
          date: latestEntry.date,
          value: average,
          count: values.length,
        });
      } else {
        // Get the latest (most recent) value for this metric
        const latestEntry = values
          .sort((a, b) => compareDateAsc(a.date, b.date))
          .pop()!;
        map.set(metricId, {
          date: latestEntry.date,
          value: latestEntry.value,
          count: 1,
        });
      }
    }

    return map;
  }, [filteredData, showAverage]);

  // Get date range display
  const dateRangeDisplay = useMemo(() => {
    if (!filteredData || filteredData.values.length === 0) return "Veri yok";

    const dates = filteredData.values
      .map((v) => parseToISO(v.date) ?? v.date)
      .sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    if (earliest === latest) {
      return formatTR(earliest);
    }

    return `${formatTR(earliest)} - ${formatTR(latest)}`;
  }, [filteredData]);

  const toggleMetric = (metricId: string) => {
    if (selectedMetrics.includes(metricId)) {
      setSelectedMetrics(selectedMetrics.filter((id) => id !== metricId));
    } else {
      setSelectedMetrics([...selectedMetrics, metricId]);
    }
  };

  const removeMetric = (metricId: string) => {
    setSelectedMetrics(selectedMetrics.filter((id) => id !== metricId));
  };

  const closeSearch = () => {
    setShowSearchInput(false);
    setSearchQuery("");
  };

  const handleSortDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !currentUser) return;

    // Save old order before updating state (for revert on failure)
    const oldOrder = [...metricOrder];

    // Update order
    const oldIndex = metricOrder.indexOf(active.id as string);
    const newIndex = metricOrder.indexOf(over.id as string);
    const newOrder = arrayMove(metricOrder, oldIndex, newIndex);
    setMetricOrder(newOrder);

    // Save to API
    try {
      const response = await fetch("/api/metric-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to save metric order:", err);
      addToast({
        type: "error",
        message: "Sıralama kaydedilemedi. Lütfen tekrar deneyin.",
        duration: 5000,
      });
      // Revert to old order on failure
      setMetricOrder(oldOrder);
    }
  };

  const resetMetricOrder = async () => {
    if (!data || !currentUser) return;

    const defaultOrder = data.metrics.map((m) => m.id);

    // Update UI
    setMetricOrder(defaultOrder);

    addToast({
      type: "success",
      message: "Sıralama varsayılana döndürüldü.",
      duration: 3000,
    });

    // Save to API
    try {
      const response = await fetch("/api/metric-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: defaultOrder }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to reset metric order:", err);
      addToast({
        type: "error",
        message: "Sıralama sıfırlanamadı. Lütfen tekrar deneyin.",
        duration: 5000,
      });
    }
  };

  const sendToTop = async (metricId: string) => {
    if (!currentUser) return;

    const index = metricOrder.indexOf(metricId);
    if (index === -1 || index === 0) return; // Already at top or not found

    // Save old order before updating state (for revert on failure)
    const oldOrder = [...metricOrder];

    // Preserve scroll position
    const container = scrollContainerRef.current;
    const scrollTop = container?.scrollTop || 0;

    // Update UI - Remove from current position and add to beginning
    const newOrder = [...metricOrder];
    newOrder.splice(index, 1);
    newOrder.unshift(metricId);
    setMetricOrder(newOrder);

    // Restore scroll position after React updates
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = scrollTop;
      }
    });

    // Save to API
    try {
      const response = await fetch("/api/metric-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to send metric to top:", err);
      addToast({
        type: "error",
        message: "Metrik en üste taşınamadı. Lütfen tekrar deneyin.",
        duration: 5000,
      });
      // Revert on failure
      setMetricOrder(oldOrder);
    }
  };

  // Handle Escape key to close search
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSearchInput) {
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showSearchInput]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState message="Veriler yükleniyor…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data) return null;

  const selectedMetricsData = selectedMetrics
    .map((id) => filteredData.metrics.find((m) => m.id === id))
    .filter(Boolean) as Metric[];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header - Product + User Info */}
        <Header
          profileName={activeProfile?.display_name}
          currentProfileId={activeProfileId || undefined}
          showUploadButton
        />

        <main className="p-2 sm:p-3 md:p-4 space-y-3">
          {/* Empty State - shown when no metrics/reports */}
          {data && data.metrics.length === 0 && (
            <Card className="rounded-xl">
              <EmptyState profileName={activeProfile?.display_name} />
            </Card>
          )}

          {/* Metric Grid Widget - only shown when there's data */}
          {data && data.metrics.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader className="pb-1.5 space-y-1.5">
                {/* Row 1: Title + Average + Date */}
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Değerler
                  </CardTitle>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Average switch */}
                    <div className="flex items-center space-x-2">
                      <Label
                        htmlFor="average-switch"
                        className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline"
                      >
                        Son Değer
                      </Label>
                      <Switch
                        id="average-switch"
                        checked={showAverage}
                        onCheckedChange={setShowAverage}
                      />
                      <Label
                        htmlFor="average-switch"
                        className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline"
                      >
                        Ortalama
                      </Label>
                    </div>

                    {/* Date filter */}
                    <Select
                      value={dateRange}
                      onValueChange={(value: DateRange) => setDateRange(value)}
                    >
                      <SelectTrigger className="w-36 sm:w-40 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tümü</SelectItem>
                        <SelectItem value="90">Son 90 gün</SelectItem>
                        <SelectItem value="30">Son 30 gün</SelectItem>
                        <SelectItem value="15">Son 15 gün</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Search + Sort + Date Range Display */}
                <div className="flex items-center gap-2">
                  {/* Desktop: Search input + Sort button */}
                  <div className="hidden md:flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Ara…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 pl-8 w-48 text-xs"
                        aria-label="Metrik ara"
                      />
                    </div>
                    <div className="w-px h-5 bg-border" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortSheetOpen(true)}
                      className="h-7 gap-1 px-2"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span className="text-xs">Sırala</span>
                    </Button>
                  </div>

                  {/* Mobile: Search button + Sort button */}
                  {!showSearchInput ? (
                    <div className="flex md:hidden items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSearchInput(true)}
                        className="h-7 gap-1 px-2"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span className="text-xs">Ara</span>
                      </Button>
                      <div className="w-px h-5 bg-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSortSheetOpen(true)}
                        className="h-7 gap-1 px-2"
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                        <span className="text-xs">Sırala</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 md:hidden relative">
                      <Input
                        type="text"
                        placeholder="Ara…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 pr-8 text-xs"
                        aria-label="Metrik ara"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeSearch}
                        className="absolute right-0.5 top-0.5 h-6 w-6"
                        aria-label="Aramayı kapat"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Date range display */}
                  <div className="text-xs text-muted-foreground ml-auto">
                    {dateRangeDisplay}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 px-0">
                <div className="max-h-48 overflow-y-auto p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {displayedMetrics.map((m) => {
                      const latest = valuesByMetric.get(m.id);
                      const value = latest?.value;
                      const inRange = isValueInRange(
                        value,
                        m.ref_min,
                        m.ref_max,
                      );
                      const isSelected = selectedMetrics.includes(m.id);

                      // Determine flag status for tooltip
                      let flagStatus = "";
                      if (
                        value !== undefined &&
                        m.ref_min != null &&
                        value < m.ref_min
                      ) {
                        flagStatus = "Düşük";
                      } else if (
                        value !== undefined &&
                        m.ref_max != null &&
                        value > m.ref_max
                      ) {
                        flagStatus = "Yüksek";
                      }

                      return (
                        <Card
                          key={m.id}
                          className={cn(
                            "rounded-lg transition-[box-shadow,border-color] duration-200 cursor-pointer",
                            "hover:shadow-md hover:border-primary/50",
                            "border-l-4",
                            inRange
                              ? "border-l-status-normal"
                              : "border-l-status-critical",
                            isSelected &&
                              "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          )}
                          onClick={() => toggleMetric(m.id)}
                        >
                          <CardContent className="px-1.5 py-1 space-y-0">
                            <div className="flex items-start justify-between mb-1">
                              <div className="text-xs text-muted-foreground line-clamp-1 flex-1">
                                {m.name}
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info
                                    className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-1"
                                    aria-label="Detaylar"
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <div className="font-medium">{m.name}</div>
                                    {m.ref_min != null && m.ref_max != null ? (
                                      <div className="text-sm">
                                        Referans aralığı: {m.ref_min} -{" "}
                                        {m.ref_max} {m.unit || ""}
                                      </div>
                                    ) : m.ref_min != null ? (
                                      <div className="text-sm">
                                        Minimum: {m.ref_min} {m.unit || ""}
                                      </div>
                                    ) : m.ref_max != null ? (
                                      <div className="text-sm">
                                        Maksimum: {m.ref_max} {m.unit || ""}
                                      </div>
                                    ) : null}
                                    {flagStatus && (
                                      <div className="text-sm font-medium text-status-critical">
                                        Durum: {flagStatus}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <div
                              className={cn(
                                "text-lg font-semibold leading-none",
                                inRange
                                  ? "text-status-normal"
                                  : "text-status-critical",
                              )}
                            >
                              {typeof value === "number"
                                ? value.toFixed(1)
                                : "—"}
                              {m.unit ? (
                                <span className="text-xs ml-1 font-normal text-muted-foreground">
                                  {m.unit}
                                </span>
                              ) : null}
                            </div>
                            {latest && (
                              <div className="text-xs text-muted-foreground leading-none">
                                {showAverage && latest.count > 1
                                  ? `${latest.count} değer`
                                  : formatTR(latest.date)}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          {data && data.metrics.length > 0 && selectedMetrics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {selectedMetricsData.map((metric) => (
                <MetricChart
                  key={metric.id}
                  metric={metric}
                  values={filteredData.values}
                  onHover={setHoveredDate}
                  onRemove={() => removeMetric(metric.id)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Sort Sheet */}
        <Sheet open={sortSheetOpen} onOpenChange={setSortSheetOpen}>
          <SheetContent className="w-full sm:max-w-sm !p-0 !gap-0 overflow-hidden">
            <div className="flex flex-col h-full">
              <SheetHeader className="pb-4 pl-2 pt-6 flex-shrink-0">
                <SheetTitle className="text-base">Metrikleri Sırala</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Sıralamayı değiştirmek için metrikleri sürükleyin
                </p>
              </SheetHeader>
              <div
                ref={scrollContainerRef}
                className="flex-1 pl-2 pr-2"
                style={{
                  overflowY: "scroll",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  minHeight: 0,
                  position: "relative",
                  touchAction: "auto",
                }}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSortDragEnd}
                >
                  <SortableContext
                    items={metricOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 pb-4 mr-2">
                      {metricOrder.map((metricId, index) => {
                        const metric = data?.metrics.find(
                          (m) => m.id === metricId,
                        );
                        if (!metric) return null;

                        const latest = valuesByMetric.get(metricId);
                        const value = latest?.value;
                        const inRange = isValueInRange(
                          value,
                          metric.ref_min,
                          metric.ref_max,
                        );
                        const isFirst = index === 0;

                        return (
                          <SortableMetricItem
                            key={metricId}
                            id={metricId}
                            name={metric.name}
                            value={value}
                            unit={metric.unit}
                            inRange={inRange}
                            onSendToTop={() => sendToTop(metricId)}
                            isFirst={isFirst}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
              <div className="flex-shrink-0 p-2 border-t">
                <Button
                  variant="outline"
                  onClick={resetMetricOrder}
                  className="w-full"
                  size="sm"
                >
                  Varsayılana Dön
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
