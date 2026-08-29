import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ingestionRuns, repoSnapshots, repos } from "@/lib/db/schema";
import {
  GitHubSearchRepoItem,
  getSubscriberCount,
  mapWithConcurrency,
  searchRepositories,
  sleep,
} from "@/lib/github";

/** Languages tracked individually so the "trending" set isn't dominated by JS/Python alone. */
export const TRACKED_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "C++",
  "C",
  "C#",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "Dart",
  "Shell",
  "Scala",
  "Haskell",
  "Elixir",
  "Lua",
  "R",
] as const;

const OVERALL_PAGES = 3; // top 300 overall by stars
const PER_LANGUAGE_RESULTS = 50;
const SEARCH_DELAY_MS = 2200; // stay under the 30 req/min GitHub Search API limit

// Real "watchers" (subscribers_count) requires one GET /repos/{owner}/{repo}
// call per repo — not available on bulk /search/repositories results. We run
// these with limited concurrency and stop starting new ones once the time
// budget below is spent, so a slow run degrades gracefully (some repos just
// miss a day of watcher history) instead of risking the route's maxDuration.
const SUBSCRIBER_FETCH_CONCURRENCY = 15;
const SUBSCRIBER_FETCH_BUDGET_MS = 180_000; // 3 minutes, leaving headroom under maxDuration

// Chunk size for bulk inserts — keeps each statement's parameter count well
// under Postgres's limit while cutting round trips from ~1 per repo to ~10
// total for a run of ~1,100 repos.
const DB_BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toRepoRow(item: GitHubSearchRepoItem) {
  return {
    githubId: item.id,
    fullName: item.full_name,
    owner: item.owner.login,
    name: item.name,
    description: item.description,
    htmlUrl: item.html_url,
    homepage: item.homepage,
    avatarUrl: item.owner.avatar_url,
    language: item.language,
    topics: item.topics ?? [],
    license: item.license?.spdx_id ?? null,
    stars: item.stargazers_count,
    forks: item.forks_count,
    watchers: item.watchers_count,
    openIssues: item.open_issues_count,
    defaultBranch: item.default_branch,
    isArchived: item.archived,
    repoCreatedAt: new Date(item.created_at),
    repoPushedAt: new Date(item.pushed_at),
    ingestedAt: new Date(),
  };
}

export interface IngestResult {
  fetched: number;
  upserted: number;
}

export async function runIngestion(): Promise<IngestResult> {
  const db = getDb();
  const [run] = await db.insert(ingestionRuns).values({}).returning();

  try {
    const byId = new Map<number, GitHubSearchRepoItem>();

    for (let page = 1; page <= OVERALL_PAGES; page++) {
      const items = await searchRepositories("stars:>1000", { page });
      for (const item of items) byId.set(item.id, item);
      await sleep(SEARCH_DELAY_MS);
    }

    for (const language of TRACKED_LANGUAGES) {
      const items = await searchRepositories(
        `language:"${language}" stars:>100`,
        { perPage: PER_LANGUAGE_RESULTS },
      );
      for (const item of items) byId.set(item.id, item);
      await sleep(SEARCH_DELAY_MS);
    }

    const uniqueItems = [...byId.values()];
    const rows = uniqueItems.map(toRepoRow);

    // Bulk upsert in chunks rather than one round trip per repo — with
    // ~1,100 tracked repos, per-row inserts would themselves eat most of the
    // time budget, leaving nothing for the subscriber-count fetch below.
    const idByGithubId = new Map<number, number>();
    for (const batch of chunk(rows, DB_BATCH_SIZE)) {
      const upserted = await db
        .insert(repos)
        .values(batch)
        .onConflictDoUpdate({
          target: repos.githubId,
          set: {
            fullName: sql`excluded.full_name`,
            owner: sql`excluded.owner`,
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            htmlUrl: sql`excluded.html_url`,
            homepage: sql`excluded.homepage`,
            avatarUrl: sql`excluded.avatar_url`,
            language: sql`excluded.language`,
            topics: sql`excluded.topics`,
            license: sql`excluded.license`,
            stars: sql`excluded.stars`,
            forks: sql`excluded.forks`,
            watchers: sql`excluded.watchers`,
            openIssues: sql`excluded.open_issues`,
            defaultBranch: sql`excluded.default_branch`,
            isArchived: sql`excluded.is_archived`,
            repoPushedAt: sql`excluded.repo_pushed_at`,
            ingestedAt: sql`excluded.ingested_at`,
          },
        })
        .returning({ id: repos.id, githubId: repos.githubId });
      for (const row of upserted) idByGithubId.set(row.githubId, row.id);
    }

    // Fetch real watcher counts (subscribers_count) for every tracked repo,
    // within a fixed time budget, so watcher history builds uniformly across
    // all tracked repos rather than only for repos someone happens to view
    // (see lib/activity.ts for the complementary on-demand path, which still
    // fills this in on-demand between daily runs for freshly-viewed repos).
    const subscriberDeadline = Date.now() + SUBSCRIBER_FETCH_BUDGET_MS;
    const subscriberCounts = await mapWithConcurrency(
      uniqueItems,
      SUBSCRIBER_FETCH_CONCURRENCY,
      subscriberDeadline,
      (item) => getSubscriberCount(item.owner.login, item.name),
    );

    const snapshotRows = rows
      .map((row, i) => {
        const repoId = idByGithubId.get(uniqueItems[i].id);
        if (!repoId) return null;
        return {
          repoId,
          stars: row.stars,
          forks: row.forks,
          openIssues: row.openIssues,
          watchers: row.watchers,
          subscriberCount: subscriberCounts[i],
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    for (const batch of chunk(snapshotRows, DB_BATCH_SIZE)) {
      await db.insert(repoSnapshots).values(batch);
    }

    await db
      .update(ingestionRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        reposUpserted: uniqueItems.length,
      })
      .where(sql`${ingestionRuns.id} = ${run.id}`);

    return { fetched: byId.size, upserted: uniqueItems.length };
  } catch (error) {
    await db
      .update(ingestionRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(sql`${ingestionRuns.id} = ${run.id}`);
    throw error;
  }
}
