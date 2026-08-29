import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  GitFork,
  Star,
  Tag,
  CircleAlert,
  GitCommit,
  Users,
  GitPullRequest,
  GitMerge,
  Clock,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LanguageBadge } from "@/components/language-badge";
import { StarHistoryChart } from "@/components/charts/star-history-chart";
import { StatCard } from "@/components/stat-card";
import { formatCompactNumber, formatDate, formatRelativeTime } from "@/lib/format";
import { getRepoByOwnerAndName, getRepoStarHistory } from "@/lib/queries";
import { getReleasesForRepo } from "@/lib/releases";
import { getActivityForRepo } from "@/lib/activity";

export const revalidate = 300;

interface RepoPageProps {
  params: Promise<{ owner: string; name: string }>;
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { owner, name } = await params;
  const repo = await getRepoByOwnerAndName(owner, name);
  if (!repo) notFound();

  const [history, releases, { activity, computing }] = await Promise.all([
    getRepoStarHistory(repo.id, 180),
    getReleasesForRepo(repo.id, repo.owner, repo.name),
    getActivityForRepo(repo.id, repo.owner, repo.name),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          {repo.avatarUrl ? (
            <Image
              src={repo.avatarUrl}
              alt={repo.owner}
              width={56}
              height={56}
              className="rounded-lg"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-muted" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {repo.owner}/{repo.name}
            </h1>
            {repo.description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{repo.description}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <LanguageBadge language={repo.language} />
              {repo.license ? <Badge variant="secondary">{repo.license}</Badge> : null}
              {repo.isArchived ? <Badge variant="outline">Archived</Badge> : null}
              {repo.topics.slice(0, 5).map((topic) => (
                <Badge key={topic} variant="outline" className="text-muted-foreground">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
            View on GitHub
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Stars" value={formatCompactNumber(repo.stars)} icon={Star} />
        <StatCard label="Forks" value={formatCompactNumber(repo.forks)} icon={GitFork} />
        <StatCard
          label="Open issues"
          value={formatCompactNumber(repo.openIssues)}
          icon={CircleAlert}
        />
        <StatCard
          label="Commits (12w)"
          value={formatCompactNumber(activity?.commitsLast12Weeks ?? 0)}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <StarHistoryChart data={history} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Created" value={formatDate(repo.repoCreatedAt)} />
            <DetailRow label="Last push" value={formatRelativeTime(repo.repoPushedAt)} />
            <DetailRow label="Default branch" value={repo.defaultBranch ?? "—"} />
            {repo.homepage ? (
              <DetailRow
                label="Homepage"
                value={
                  <Link
                    href={repo.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {repo.homepage.replace(/^https?:\/\//, "")}
                  </Link>
                }
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!activity && computing ? (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Computing statistics</AlertTitle>
              <AlertDescription>
                GitHub hasn&apos;t finished computing commit stats for this repository yet —
                reload this page in a minute or two.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ActivityStat
                icon={GitCommit}
                label="Commits (4w)"
                value={formatCompactNumber(activity?.commitsLast4Weeks ?? 0)}
              />
              <ActivityStat
                icon={Users}
                label="Contributors"
                value={
                  activity && activity.contributorCount >= 100
                    ? "100+"
                    : formatCompactNumber(activity?.contributorCount ?? 0)
                }
              />
              <ActivityStat
                icon={GitPullRequest}
                label="Open PRs"
                value={formatCompactNumber(activity?.openPullRequests ?? 0)}
              />
              <ActivityStat
                icon={GitMerge}
                label="Merged PRs (30d)"
                value={formatCompactNumber(activity?.mergedPullRequestsLast30d ?? 0)}
              />
            </div>
          )}
          {activity && computing ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing the last cached values while GitHub recomputes commit statistics.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent releases</CardTitle>
        </CardHeader>
        <CardContent>
          {releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">This repository has no releases.</p>
          ) : (
            <ul className="divide-y divide-border">
              {releases.map((release) => (
                <li key={release.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Link
                      href={release.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium hover:underline"
                    >
                      {release.name || release.tagName}
                    </Link>
                    {release.isPrerelease ? (
                      <Badge variant="outline" className="shrink-0">
                        Pre-release
                      </Badge>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(release.publishedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ActivityStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-lg font-semibold leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
