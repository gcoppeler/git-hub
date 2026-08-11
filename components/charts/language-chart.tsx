"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getLanguageColor } from "@/lib/language-colors";
import { formatCompactNumber } from "@/lib/format";

interface LanguageChartRow {
  language: string | null;
  repoCount: number;
  totalStars: number;
}

export function LanguageChart({ data }: { data: LanguageChartRow[] }) {
  const rows = data
    .filter((row): row is LanguageChartRow & { language: string } => Boolean(row.language))
    .map((row, index) => ({
      language: row.language,
      totalStars: row.totalStars,
      repoCount: row.repoCount,
      fill: getLanguageColor(row.language, index),
    }));

  const config: ChartConfig = rows.reduce((acc, row) => {
    acc[row.language] = { label: row.language, color: row.fill };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickFormatter={(value) => formatCompactNumber(Number(value))}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="language"
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCompactNumber(Number(value))}
              labelKey="language"
            />
          }
        />
        <Bar dataKey="totalStars" radius={4}>
          {rows.map((row) => (
            <Cell key={row.language} fill={row.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
