"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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

type UserConfig = {
  id: string;
  name: string;
  username: string;
  dataSheetName: string;
  referenceSheetName: string;
};
import { compareDateAsc, parseToISO, formatTR } from "@/lib/date";
import { MetricChart } from "@/components/metric-chart";
import { MetricChip } from "@/components/metric-chip";
import { LoginGate } from "@/components/login-gate";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

type ApiData = { metrics: Metric[]; values: MetricValue[] };

type DateRange = "all" | "15" | "30" | "90";

// Normalize Turkish characters for search
function normalizeTurkish(str: string): string {
  return str
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

// Sortable metric item for the sort sheet
function SortableMetricItem({
  id,
  name,
  value,
  unit,
  inRange
}: {
  id: string;
  name: string;
  value?: number;
  unit?: string;
  inRange: boolean;
}) {
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

  const accent = inRange ? "emerald" : "rose";

  return (
    <div
      ref={setNodeRef}
      style={{...style, pointerEvents: 'auto'}}
      className={cn(
        "flex items-center gap-2 p-2 border rounded-lg transition-all",
        isDragging
          ? "opacity-40 scale-105 shadow-lg cursor-grabbing"
          : "hover:shadow-sm opacity-100",
        `bg-${accent}-50 dark:bg-${accent}-900/20 border-${accent}-200/60 dark:border-${accent}-900/40`
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
        style={{ touchAction: 'none', pointerEvents: 'auto' }}
        onTouchStart={(e) => {
          console.log(`[TOUCH] Handle touch start: ${name}`);
          e.stopPropagation();
        }}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0" style={{pointerEvents: 'none'}}>
        <div className="text-xs text-muted-foreground truncate">{name}</div>
        <div
          className={cn(
            "text-sm font-semibold",
            inRange
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
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
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [, setHoveredDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [showAverage, setShowAverage] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserConfig | null>(null);
  const hasAutoSelected = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [metricOrder, setMetricOrder] = useState<string[]>([]);
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
    })
  );

  console.log("[DND] Sensors configured - TouchSensor DISABLED for testing");

  // Log when sort sheet opens/closes
  useEffect(() => {
    if (sortSheetOpen) {
      console.log("[SORT SHEET] Opened");
    } else {
      console.log("[SORT SHEET] Closed");
    }
  }, [sortSheetOpen]);

  // Add native scroll listener (bypasses React synthetic events)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleNativeScroll = () => {
      console.log("[SCROLL] NATIVE scroll event fired!", {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight
      });
    };

    container.addEventListener('scroll', handleNativeScroll, { passive: true });
    console.log("[SCROLL] Native scroll listener attached");

    return () => {
      container.removeEventListener('scroll', handleNativeScroll);
    };
  }, [sortSheetOpen]);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("viziai_user");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log("[LOGIN] Auto-login from localStorage:", user.name);
        setCurrentUser(user);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("[LOGIN] Failed to parse saved user", error);
        localStorage.removeItem("viziai_user");
      }
    } else {
      console.log("[LOGIN] No saved user found");
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/data?userId=${currentUser!.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load data");
        const json = (await res.json()) as ApiData;
        if (!ignore) {
          setData(json);
          // Initialize metric order if empty
          if (metricOrder.length === 0) {
            setMetricOrder(json.metrics.map(m => m.id));
          }
        }
      } catch (e: unknown) {
        if (!ignore) setError((e as Error)?.message ?? "Error");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [currentUser]);

  // Auto-select Hemoglobin when data is loaded
  useEffect(() => {
    if (data && !hasAutoSelected.current) {
      const hemoglobinMetric = data.metrics.find(metric =>
        metric.name.toLowerCase().includes('hemoglobin')
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

    if (dateRange === "all") return data;

    const days = parseInt(dateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffString = cutoffDate.toISOString().split("T")[0];

    // Filter values that are within the date range
    const filteredValues = data.values.filter((v) => {
      const iso = parseToISO(v.date);
      if (!iso) return false;
      return iso >= cutoffString;
    });

    return { ...data, values: filteredValues };
  }, [data, dateRange]);

  // Sort and filter metrics based on order and search query
  const displayedMetrics = useMemo(() => {
    let metrics = filteredData.metrics;

    // Apply search filter
    if (searchQuery && searchQuery.length > 1) {
      const normalizedQuery = normalizeTurkish(searchQuery);
      metrics = metrics.filter((m) =>
        normalizeTurkish(m.name).includes(normalizedQuery)
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
    const map = new Map<string, { date: string; value: number; count: number }>();

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
        map.set(metricId, { date: latestEntry.date, value: average, count: values.length });
      } else {
        // Get the latest (most recent) value for this metric
        const latestEntry = values
          .sort((a, b) => compareDateAsc(a.date, b.date))
          .pop()!;
        map.set(metricId, { date: latestEntry.date, value: latestEntry.value, count: 1 });
      }
    }

    return map;
  }, [filteredData, showAverage]);

  // Get date range display
  const dateRangeDisplay = useMemo(() => {
    if (!filteredData || filteredData.values.length === 0) return "No data";

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedMetrics((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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

    // Save the old order for potential rollback
    const oldOrder = [...metricOrder];

    // Optimistically update UI
    const oldIndex = metricOrder.indexOf(active.id as string);
    const newIndex = metricOrder.indexOf(over.id as string);
    const newOrder = arrayMove(metricOrder, oldIndex, newIndex);
    setMetricOrder(newOrder);

    // Call API to persist the change
    try {
      const response = await fetch('/api/reorder-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          newMetricOrder: newOrder,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder columns');
      }

      // Success - order is already correct in UI
      console.log('[REORDER] Successfully persisted metric order to Google Sheets');
    } catch (error) {
      // Error - revert UI to old order
      console.error('[REORDER] Failed to persist order:', error);
      setMetricOrder(oldOrder);
      addToast({
        type: 'error',
        message: 'Sıralama kaydedilemedi. Lütfen tekrar deneyin.',
        duration: 5000,
      });
    }
  };

  const resetMetricOrder = async () => {
    if (!data || !currentUser) return;

    const oldOrder = [...metricOrder];
    const defaultOrder = data.metrics.map(m => m.id);

    // Optimistically update UI
    setMetricOrder(defaultOrder);

    // Call API to persist the reset
    try {
      const response = await fetch('/api/reorder-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          newMetricOrder: defaultOrder,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset column order');
      }

      console.log('[REORDER] Successfully reset metric order');
      addToast({
        type: 'success',
        message: 'Sıralama varsayılana döndürüldü.',
        duration: 3000,
      });
    } catch (error) {
      // Error - revert UI
      console.error('[REORDER] Failed to reset order:', error);
      setMetricOrder(oldOrder);
      addToast({
        type: 'error',
        message: 'Sıralama sıfırlanamadı. Lütfen tekrar deneyin.',
        duration: 5000,
      });
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

  if (!isLoggedIn) {
    return <LoginGate onLogin={(userConfig) => {
      setCurrentUser(userConfig);
      setIsLoggedIn(true);
      // Save user to localStorage
      localStorage.setItem("viziai_user", JSON.stringify(userConfig));
    }} />;
  }

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }
  if (!data) return null;

  const selectedMetricsData = selectedMetrics
    .map((id) => filteredData.metrics.find((m) => m.id === id))
    .filter(Boolean) as Metric[];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
      {/* Header - Product + User Info */}
      <header className="border-b bg-card">
        <div className="px-4 py-3 sm:px-6 md:px-8">
          <div className="flex items-center justify-between">
            <div
              className="text-xl sm:text-2xl font-bold text-primary cursor-pointer hover:text-primary/80"
              onClick={() => router.push("/")}
            >
              ViziAI
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium hidden sm:inline">
                {currentUser?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsLoggedIn(false);
                  setCurrentUser(null);
                  // Clear user from localStorage
                  localStorage.removeItem("viziai_user");
                  router.push("/");
                }}
              >
                Çıkış
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-8 space-y-6">
        {/* Metric Grid Widget */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3 space-y-3">
            {/* Row 1: Title + Average + Date */}
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Değerler
              </CardTitle>

              <div className="flex items-center gap-3 ml-auto">
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
                  <SelectTrigger className="w-36 sm:w-40">
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
            <div className="flex items-center gap-3">
              {/* Desktop: Search input + Sort button */}
              <div className="hidden md:flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 w-48"
                  />
                </div>
                <div className="w-px h-5 bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortSheetOpen(true)}
                  className="h-8 gap-1.5"
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
                    className="h-8 gap-1.5"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="text-xs">Ara</span>
                  </Button>
                  <div className="w-px h-5 bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortSheetOpen(true)}
                    className="h-8 gap-1.5"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="text-xs">Sırala</span>
                  </Button>
                </div>
              ) : (
                <div className="flex-1 md:hidden relative">
                  <Input
                    type="text"
                    placeholder="Ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pr-8"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeSearch}
                    className="absolute right-0.5 top-0.5 h-7 w-7"
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
          <CardContent className="pt-0">
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {displayedMetrics.map((m) => {
                  const latest = valuesByMetric.get(m.id);
                  const value = latest?.value;
                  const inRange =
                    typeof value === "number" &&
                    (m.ref_min == null || value >= m.ref_min) &&
                    (m.ref_max == null || value <= m.ref_max);
                  const accent = inRange ? "emerald" : "rose";
                  const isSelected = selectedMetrics.includes(m.id);
                  
                  // Determine flag status
                  let flagStatus = "";
                  if (typeof value === "number") {
                    if (m.ref_min != null && value < m.ref_min) {
                      flagStatus = "Düşük";
                    } else if (m.ref_max != null && value > m.ref_max) {
                      flagStatus = "Yüksek";
                    }
                  }

                  return (
                    <Card
                      key={m.id}
                      className={cn(
                        "rounded-xl transition cursor-pointer hover:shadow-md",
                        `bg-${accent}-50 dark:bg-${accent}-900/20 border-${accent}-200/60 dark:border-${accent}-900/40`,
                        isSelected && "ring-2 ring-primary ring-offset-4"
                      )}
                      onClick={() => toggleMetric(m.id)}
                    >
                      <CardContent className="p-2">
                        <div className="flex items-start justify-between mb-1">
                          <div className="text-xs text-muted-foreground line-clamp-1 flex-1">
                            {m.name}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-1" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <div className="font-medium">{m.name}</div>
                                {m.ref_min != null && m.ref_max != null ? (
                                  <div className="text-sm">
                                    Referans aralığı: {m.ref_min} - {m.ref_max} {m.unit || ""}
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
                                  <div className="text-sm font-medium text-rose-600">
                                    Durum: {flagStatus}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div
                          className={cn(
                            "text-lg font-semibold",
                            inRange
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                          )}
                        >
                          {typeof value === "number" ? value.toFixed(1) : "—"}
                          {m.unit ? (
                            <span className="text-xs ml-1 font-normal text-muted-foreground">
                              {m.unit}
                            </span>
                          ) : null}
                        </div>
                        {latest && (
                          <div className="text-xs text-muted-foreground mt-0.5">
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

        {/* Chart Chips and Charts */}
        {selectedMetrics.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedMetrics}
                  strategy={verticalListSortingStrategy}
                >
                  {selectedMetrics.map((metricId) => {
                    const metric = filteredData.metrics.find(
                      (m) => m.id === metricId
                    );
                    if (!metric) return null;
                    return (
                      <MetricChip
                        key={metricId}
                        id={metricId}
                        name={metric.name}
                        onRemove={() => removeMetric(metricId)}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>

            {/* Charts */}
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
                overflowY: 'scroll',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                minHeight: 0,
                position: 'relative',
                touchAction: 'auto'
              }}
              onScroll={(e) => {
                console.log("[SCROLL] Container scrolled:", {
                  scrollTop: e.currentTarget.scrollTop,
                  scrollHeight: e.currentTarget.scrollHeight,
                  clientHeight: e.currentTarget.clientHeight
                });
              }}
              onTouchStart={(e) => {
                const el = e.currentTarget;
                console.log("[TOUCH] Container touch start:", {
                  touches: e.touches.length,
                  y: e.touches[0]?.clientY,
                  target: (e.target as HTMLElement).className,
                  scrollHeight: el.scrollHeight,
                  clientHeight: el.clientHeight,
                  canScroll: el.scrollHeight > el.clientHeight
                });
              }}
              onTouchMove={(e) => {
                console.log("[TOUCH] Container touch move:", {
                  y: e.touches[0]?.clientY
                });
              }}
              onTouchEnd={() => {
                console.log("[TOUCH] Container touch end");
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
                    {metricOrder.map((metricId) => {
                      const metric = data?.metrics.find((m) => m.id === metricId);
                      if (!metric) return null;

                      const latest = valuesByMetric.get(metricId);
                      const value = latest?.value;
                      const inRange =
                        typeof value === "number" &&
                        (metric.ref_min == null || value >= metric.ref_min) &&
                        (metric.ref_max == null || value <= metric.ref_max);

                      return (
                        <SortableMetricItem
                          key={metricId}
                          id={metricId}
                          name={metric.name}
                          value={value}
                          unit={metric.unit}
                          inRange={inRange}
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
