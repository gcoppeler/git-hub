import { Boxes, GitFork, Languages, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { GrowthTable } from "@/components/growth-table";
import { GrowthWindowToggle, parseGrowthWindow } from "@/components/growth-window-toggle";
import { LanguageChart } from "@/components/charts/language-chart";
import { SetupRequired } from "@/components/setup-required";
import { EmptyDataset } from "@/components/empty-dataset";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { getFastestGrowing, getLanguageBreakdown, getOverviewStats, listRepos } from "@/lib/queries";

export const revalidate = 300;

interface OverviewPageProps {
  searchParams: Promise<{ window?: string }>;
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  if (!process.env.DATABASE_URL) {
    return <SetupRequired />;
  }

  const params = await searchParams;
  const growthWindow = parseGrowthWindow(params.window);

  const [stats, topRepos, fastestGrowing, languages] = await Promise.all([
    getOverviewStats(),
    listRepos({ limit: 10 }),
    getFastestGrowing({ windowDays: growthWindow, limit: 8 }),
    getLanguageBreakdown(10),
  ]);

  if (stats.repoCount === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyDataset />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">GitHub Insights</h1>
        <p className="text-sm text-muted-foreground">
          Stats and trends for a curated set of the most popular public GitHub repositories.
          Last refreshed {formatRelativeTime(stats.lastIngestedAt)}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tracked repositories"
          value={formatNumber(stats.repoCount)}
          icon={Boxes}
        />
        <StatCard label="Stars tracked" value={formatNumber(stats.totalStars)} icon={Star} />
        <StatCard label="Forks tracked" value={formatNumber(stats.totalForks)} icon={GitFork} />
        <StatCard
          label="Languages tracked"
          value={formatNumber(stats.languageCount)}
          icon={Languages}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Stars by language</CardTitle>
          </CardHeader>
          <CardContent>
            <LanguageChart data={languages} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Fastest growing</CardTitle>
            <GrowthWindowToggle active={growthWindow} />
          </CardHeader>
          <CardContent>
            <GrowthTable rows={fastestGrowing} windowDays={growthWindow} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top repositories overall</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderboardTable repos={topRepos} />
        </CardContent>
      </Card>
    </div>
  );
}
