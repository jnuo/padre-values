"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metric, MetricValue } from "@/lib/sheets";
import { compareDateAsc, parseToISO, formatTR } from "@/lib/date";
import { cn } from "@/lib/utils";

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

export function MetricChart({ metric, values, onHover, onRemove, className }: MetricChartProps) {
  // Sort values by date and create chart data
  const chartData: ChartData[] = values
    .filter(v => v.metric_id === metric.id)
    .sort((a, b) => compareDateAsc(a.date, b.date))
    .map(v => ({ date: parseToISO(v.date) ?? v.date, value: v.value }));

  if (chartData.length === 0) {
    return (
      <Card className={cn("rounded-2xl", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate Y-axis range
  const dataValues = chartData.map(d => d.value).filter(v => v !== null) as number[];
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
  const inRange = latestValue !== null && 
    (metric.ref_min == null || latestValue >= metric.ref_min) &&
    (metric.ref_max == null || latestValue <= metric.ref_max);

  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                inRange 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" 
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
              )}
            >
              {latestValue !== null ? `${latestValue} ${metric.unit}` : "No data"}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              syncId="labs-sync"
              syncMethod="value"
              onMouseMove={(state: { activeLabel?: string }) => onHover(state?.activeLabel ?? null)}
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
                  fill="rgb(34, 197, 94)"
                  fillOpacity={0.15}
                  stroke="rgb(34, 197, 94)"
                  strokeDasharray="1 1"
                  strokeOpacity={0.4}
                  className="drop-shadow-sm"
                />
              )}
              
              {/* Reference lines for min and max */}
              {metric.ref_min !== null && (
                <ReferenceLine
                  y={metric.ref_min}
                  stroke="rgb(34, 197, 94)"
                  strokeDasharray="2 2"
                  strokeOpacity={0.6}
                  label={{ value: `Min: ${metric.ref_min}`, position: "top" }}
                />
              )}
              {metric.ref_max !== null && (
                <ReferenceLine
                  y={metric.ref_max}
                  stroke="rgb(34, 197, 94)"
                  strokeDasharray="2 2"
                  strokeOpacity={0.6}
                  label={{ value: `Max: ${metric.ref_max}`, position: "top" }}
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
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload as ChartData;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="font-medium">{metric.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {data.value !== null ? `${data.value} ${metric.unit}` : "No data"}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTR(label as string)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={inRange ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
                strokeWidth={2}
                dot={{ fill: inRange ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
