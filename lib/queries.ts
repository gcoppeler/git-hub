import { and, asc, desc, eq, gte, ilike, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ingestionRuns, releases, repoSnapshots, repos } from "@/lib/db/schema";

export type RepoSort = "stars" | "forks" | "open_issues" | "recently_pushed";

const SORT_COLUMN = {
  stars: repos.stars,
  forks: repos.forks,
  open_issues: repos.openIssues,
  recently_pushed: repos.repoPushedAt,
} as const;

export async function getOverviewStats() {
  const db = getDb();
  const [row] = await db
    .select({
      repoCount: sql<number>`count(*)`.mapWith(Number),
      totalStars: sql<number>`coalesce(sum(${repos.stars}), 0)`.mapWith(Number),
      totalForks: sql<number>`coalesce(sum(${repos.forks}), 0)`.mapWith(Number),
      languageCount: sql<number>`count(distinct ${repos.language})`.mapWith(Number),
    })
    .from(repos);

  const [lastRun] = await db
    .select({ finishedAt: ingestionRuns.finishedAt, status: ingestionRuns.status })
    .from(ingestionRuns)
    .where(eq(ingestionRuns.status, "success"))
    .orderBy(desc(ingestionRuns.finishedAt))
    .limit(1);

  return { ...row, lastIngestedAt: lastRun?.finishedAt ?? null };
}

export interface ListReposOptions {
  language?: string;
  search?: string;
  sort?: RepoSort;
  limit?: number;
  offset?: number;
}

export async function listRepos({
  language,
  search,
  sort = "stars",
  limit = 50,
  offset = 0,
}: ListReposOptions = {}) {
  const db = getDb();
  const conditions = [];
  if (language) conditions.push(eq(repos.language, language));
  if (search) conditions.push(ilike(repos.fullName, `%${search}%`));

  return db
    .select()
    .from(repos)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(SORT_COLUMN[sort]))
    .limit(limit)
    .offset(offset);
}

export async function getLanguageBreakdown(limit = 12) {
  const db = getDb();
  return db
    .select({
      language: repos.language,
      repoCount: sql<number>`count(*)`.mapWith(Number),
      totalStars: sql<number>`coalesce(sum(${repos.stars}), 0)`.mapWith(Number),
    })
    .from(repos)
    .where(sql`${repos.language} is not null`)
    .groupBy(repos.language)
    .orderBy(desc(sql`sum(${repos.stars})`))
    .limit(limit);
}

export interface FastestGrowingRow {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  avatarUrl: string | null;
  language: string | null;
  stars: number;
  starGrowth: number;
}

export async function getFastestGrowing(
  { windowDays = 7, limit = 10 }: { windowDays?: number; limit?: number } = {},
): Promise<FastestGrowingRow[]> {
  const db = getDb();
  const result = await db.execute<{
    id: number;
    full_name: string;
    owner: string;
    name: string;
    avatar_url: string | null;
    language: string | null;
    stars: number;
    star_growth: number;
  }>(sql`
    with baseline as (
      select distinct on (repo_id) repo_id, stars as baseline_stars
      from ${repoSnapshots}
      where captured_at <= now() - interval '1 day' * ${windowDays}
      order by repo_id, captured_at desc
    )
    select
      ${repos.id} as id,
      ${repos.fullName} as full_name,
      ${repos.owner} as owner,
      ${repos.name} as name,
      ${repos.avatarUrl} as avatar_url,
      ${repos.language} as language,
      ${repos.stars} as stars,
      (${repos.stars} - baseline.baseline_stars) as star_growth
    from ${repos}
    join baseline on baseline.repo_id = ${repos.id}
    order by star_growth desc
    limit ${limit}
  `);

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    owner: row.owner,
    name: row.name,
    avatarUrl: row.avatar_url,
    language: row.language,
    stars: row.stars,
    starGrowth: row.star_growth,
  }));
}

export async function getRepoByOwnerAndName(owner: string, name: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(repos)
    .where(
      and(
        ilike(repos.owner, owner),
        ilike(repos.name, name),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getRepoStarHistory(repoId: number, days = 90) {
  const db = getDb();
  return db
    .select({
      capturedAt: repoSnapshots.capturedAt,
      stars: repoSnapshots.stars,
      forks: repoSnapshots.forks,
      openIssues: repoSnapshots.openIssues,
      watchers: repoSnapshots.watchers,
      // Real watcher count (subscribers_count), only populated on snapshots
      // written from lib/activity.ts's on-demand refresh — null on rows from
      // the daily bulk cron. Not enough history has accumulated yet to plot;
      // ready to add as a "Watchers" line in star-history-chart.tsx later.
      subscriberCount: repoSnapshots.subscriberCount,
    })
    .from(repoSnapshots)
    .where(
      and(
        eq(repoSnapshots.repoId, repoId),
        gte(repoSnapshots.capturedAt, sql`now() - interval '1 day' * ${days}`),
      ),
    )
    .orderBy(asc(repoSnapshots.capturedAt));
}

export async function getRepoReleases(repoId: number, limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(releases)
    .where(eq(releases.repoId, repoId))
    .orderBy(desc(releases.publishedAt))
    .limit(limit);
}

export async function getDistinctLanguages() {
  const db = getDb();
  const rows = await db
    .select({ language: repos.language })
    .from(repos)
    .where(sql`${repos.language} is not null`)
    .groupBy(repos.language)
    .orderBy(asc(repos.language));
  return rows.map((r) => r.language!).filter(Boolean);
}
