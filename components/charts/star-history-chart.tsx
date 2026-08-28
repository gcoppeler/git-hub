"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompactNumber, formatDate } from "@/lib/format";

interface StarHistoryPoint {
  capturedAt: Date | string;
  stars: number;
}

const config: ChartConfig = {
  stars: { label: "Stars", color: "var(--chart-1)" },
};

export function StarHistoryChart({ data }: { data: StarHistoryPoint[] }) {
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
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <AreaChart data={rows} margin={{ left: 8, right: 8 }}>
        <defs>
          <linearGradient id="fillStars" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
          </linearGradient>
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
          dataKey="stars"
          type="monotone"
          fill="url(#fillStars)"
          stroke="var(--chart-1)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
