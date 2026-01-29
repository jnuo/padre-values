"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metric, MetricValue } from "@/lib/sheets";
import { compareDateAsc, parseToISO, formatTR } from "@/lib/date";
import { cn } from "@/lib/utils";

// Hook to get CSS variable colors for charts (Recharts needs actual color values)
function useChartColors() {
  const [colors, setColors] = useState({
    statusNormal: "#22c55e",
    statusCritical: "#dc6843",
    chartPrimary: "#0d9488",
  });

  useEffect(() => {
    const updateColors = () => {
      // Detect theme via class (OKLCH parsing is complex, using direct hex values)
      const isDark = document.documentElement.classList.contains("dark");

      setColors({
        statusNormal: isDark ? "#4ade80" : "#22c55e",
        statusCritical: isDark ? "#f87171" : "#dc6843",
        chartPrimary: isDark ? "#2dd4bf" : "#0d9488",
      });
    };

    updateColors();

    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.attributeName === "class" &&
          mutation.target === document.documentElement
        ) {
          updateColors();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return colors;
}

type ChartData = {
  date: string; // original date string from API
  value: number | null;
};

type MetricChartProps = {
  metric: Metric;
  values: MetricValue[];
  onHover: (date: string | null) => void;
  onRemove: () => void;
  className?: string;
};

export function MetricChart({
  metric,
  values,
  onHover,
  onRemove,
  className,
}: MetricChartProps) {
  const colors = useChartColors();

  // Sort values by date and create chart data
  const chartData: ChartData[] = values
    .filter((v) => v.metric_id === metric.id)
    .sort((a, b) => compareDateAsc(a.date, b.date))
    .map((v) => ({ date: parseToISO(v.date) ?? v.date, value: v.value }));

  if (chartData.length === 0) {
    return (
      <Card className={cn("rounded-xl", className)}>
        <CardHeader className="!px-3 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="!px-3 pt-0 pb-2">
          <div className="text-sm text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate Y-axis range
  const dataValues = chartData
    .map((d) => d.value)
    .filter((v) => v !== null) as number[];
  const minValue = Math.min(...dataValues);
  const maxValue = Math.max(...dataValues);

  // Include reference range in calculation
  const refMin = metric.ref_min ?? minValue;
  const refMax = metric.ref_max ?? maxValue;
  const rangeMin = Math.min(minValue, refMin);
  const rangeMax = Math.max(maxValue, refMax);

  // Add 10% headroom
  const range = rangeMax - rangeMin;
  const padding = range * 0.1;
  const yMin = Math.max(0, rangeMin - padding); // Clamp to 0 if metric can't be negative
  const yMax = rangeMax + padding;

  // Determine if value is in range
  const latestValue = chartData[chartData.length - 1]?.value;
  const inRange =
    latestValue !== null &&
    (metric.ref_min == null || latestValue >= metric.ref_min) &&
    (metric.ref_max == null || latestValue <= metric.ref_max);

  return (
    <Card className={cn("rounded-xl", className)}>
      <CardHeader className="!px-3 pt-3 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                inRange
                  ? "bg-status-normal/15 text-status-normal"
                  : "bg-status-critical/15 text-status-critical",
              )}
            >
              {latestValue !== null
                ? `${latestValue} ${metric.unit}`
                : "No data"}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="!px-3 pt-0 pb-2">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              syncId="labs-sync"
              syncMethod="value"
              onMouseMove={(state: { activeLabel?: string }) =>
                onHover(state?.activeLabel ?? null)
              }
              onMouseLeave={() => onHover(null)}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />

              {/* Reference range area */}
              {metric.ref_min !== null && metric.ref_max !== null && (
                <ReferenceArea
                  x1="dataMin"
                  x2="dataMax"
                  y1={metric.ref_min}
                  y2={metric.ref_max}
                  fill={colors.statusNormal}
                  fillOpacity={0.15}
                  stroke={colors.statusNormal}
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                />
              )}

              {/* Reference lines for min and max */}
              {metric.ref_min !== null && (
                <ReferenceLine
                  y={metric.ref_min}
                  stroke={colors.statusNormal}
                  strokeDasharray="2 2"
                  strokeOpacity={0.6}
                  label={{
                    value: `Min: ${metric.ref_min}`,
                    position: "insideTopRight",
                    fill: colors.statusNormal,
                    fontSize: 10,
                  }}
                />
              )}
              {metric.ref_max !== null && (
                <ReferenceLine
                  y={metric.ref_max}
                  stroke={colors.statusNormal}
                  strokeDasharray="2 2"
                  strokeOpacity={0.6}
                  label={{
                    value: `Max: ${metric.ref_max}`,
                    position: "insideBottomRight",
                    fill: colors.statusNormal,
                    fontSize: 10,
                  }}
                />
              )}

              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatTR(value)}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickCount={6}
                tickFormatter={(value: number) => {
                  // Fix floating-point precision issues (e.g., 6.609999999999999 → 6.61)
                  if (Number.isInteger(value)) return value.toString();
                  // Max 2 decimal places, remove trailing zeros
                  return parseFloat(value.toFixed(2)).toString();
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload as ChartData;
                    const valueInRange =
                      data.value !== null &&
                      (metric.ref_min == null ||
                        data.value >= metric.ref_min) &&
                      (metric.ref_max == null || data.value <= metric.ref_max);
                    return (
                      <div className="rounded-lg border bg-popover p-3 shadow-lg">
                        <p className="font-medium text-popover-foreground">
                          {metric.name}
                        </p>
                        <p
                          className={cn(
                            "text-lg font-semibold",
                            valueInRange
                              ? "text-brand-primary"
                              : "text-status-critical",
                          )}
                        >
                          {data.value !== null
                            ? `${data.value} ${metric.unit}`
                            : "No data"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTR(label as string)}
                        </p>
                        {metric.ref_min !== null && metric.ref_max !== null && (
                          <p className="mt-1 text-xs text-status-normal">
                            Range: {metric.ref_min} - {metric.ref_max}{" "}
                            {metric.unit}
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={inRange ? colors.chartPrimary : colors.statusCritical}
                strokeWidth={2}
                dot={{
                  fill: inRange ? colors.chartPrimary : colors.statusCritical,
                  stroke: inRange ? colors.chartPrimary : colors.statusCritical,
                  strokeWidth: 2,
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  strokeWidth: 2,
                  fill: inRange ? colors.chartPrimary : colors.statusCritical,
                  stroke: inRange ? colors.chartPrimary : colors.statusCritical,
                }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
