"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Metric, MetricValue } from "@/lib/sheets";
import { Info } from "lucide-react";

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

type ApiData = { metrics: Metric[]; values: MetricValue[] };

type DateRange = "all" | "15" | "30" | "90";

export default function Dashboard() {
  const router = useRouter();
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!currentUser) return;
    
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/data?userId=${currentUser!.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load data");
        const json = (await res.json()) as ApiData;
        if (!ignore) setData(json);
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

  const valuesByMetric = useMemo(() => {
    if (!filteredData)
      return new Map<string, { date: string; value: number }>();
    const map = new Map<string, { date: string; value: number }>();

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
        map.set(metricId, { date: latestEntry.date, value: average });
      } else {
        // Get the latest (most recent) value for this metric
        const latestEntry = values
          .sort((a, b) => compareDateAsc(a.date, b.date))
          .pop()!;
        map.set(metricId, { date: latestEntry.date, value: latestEntry.value });
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

  if (!isLoggedIn) {
    return <LoginGate onLogin={(userConfig) => {
      setCurrentUser(userConfig);
      setIsLoggedIn(true);
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => router.push("/")}
              className="text-2xl font-bold text-primary hover:text-primary/80"
            >
              ViziAI
            </Button>
            <h1 className="text-xl font-semibold">
              {currentUser?.name} Tahlil Sonuçları
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {dateRangeDisplay}
            </div>
            <Select
              value={dateRange}
              onValueChange={(value: DateRange) => setDateRange(value)}
            >
              <SelectTrigger className="w-32">
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
      </header>

      <main className="p-4 sm:p-6 md:p-8 space-y-6">
        {/* Metric Grid Widget */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Değerler
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="average-switch"
                  className="text-xs text-muted-foreground"
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
                  className="text-xs text-muted-foreground"
                >
                  Ortalama
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="max-h-80 overflow-y-auto p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredData.metrics.map((m) => {
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
    </div>
    </TooltipProvider>
  );
}
