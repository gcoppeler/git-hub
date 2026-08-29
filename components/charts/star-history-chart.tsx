"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StarHistoryPoint {
  capturedAt: Date | string;
  stars: number;
  forks: number;
  openIssues: number;
}

// Note: GitHub's `watchers_count` (what `repoSnapshots.watchers` stores) is a
// deprecated field that always mirrors `stargazers_count` — it's not a real
// distinct metric, so there's no accurate trend to show for it here. The
// corrected "real" watcher count (`subscribers_count`) is fetched lazily per
// repo view instead (see lib/activity.ts) and shown as a point-in-time stat,
// not a historical series.
const METRICS = [
  { key: "stars", label: "Stars", color: "var(--chart-1)", gradientId: "fillStars" },
  { key: "forks", label: "Forks", color: "var(--chart-2)", gradientId: "fillForks" },
  {
    key: "openIssues",
    label: "Open issues",
    color: "var(--chart-3)",
    gradientId: "fillOpenIssues",
  },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

const config: ChartConfig = {
  stars: { label: "Stars", color: "var(--chart-1)" },
  forks: { label: "Forks", color: "var(--chart-2)" },
  openIssues: { label: "Open issues", color: "var(--chart-3)" },
};

export function StarHistoryChart({ data }: { data: StarHistoryPoint[] }) {
  const [metric, setMetric] = useState<MetricKey>("stars");

  if (data.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Not enough history yet — check back after the next ingestion run.
      </div>
    );
  }

  const rows = data.map((point) => ({
    // ChartTooltipContent only treats the hovered axis value as a real label
    // when it's a string — otherwise it substitutes the series name from
    // `config` (e.g. "Stars"), which then breaks `formatDate`. Stringify here
    // so the tooltip receives the actual date instead of that fallback.
    capturedAt: new Date(point.capturedAt).toISOString(),
    stars: point.stars,
    forks: point.forks,
    openIssues: point.openIssues,
  }));

  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <div>
      <div className="mb-3 inline-flex items-center rounded-md border border-border p-0.5 text-xs">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={cn(
              "rounded-sm px-2.5 py-1 transition-colors",
              metric === m.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
        <AreaChart data={rows} margin={{ left: 8, right: 8 }}>
          <defs>
            {METRICS.map((m) => (
              <linearGradient key={m.key} id={m.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={m.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={m.color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="capturedAt"
            tickFormatter={(value) => formatDate(value)}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(value) => formatCompactNumber(Number(value))}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatDate(value as string)}
                formatter={(value) => formatCompactNumber(Number(value))}
              />
            }
          />
          <Area
            key={active.key}
            dataKey={active.key}
            type="monotone"
            fill={`url(#${active.gradientId})`}
            stroke={active.color}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
