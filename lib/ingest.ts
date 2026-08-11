import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ingestionRuns, repoSnapshots, repos } from "@/lib/db/schema";
import { GitHubSearchRepoItem, searchRepositories, sleep } from "@/lib/github";

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

    for (const item of uniqueItems) {
      const row = toRepoRow(item);
      const [upserted] = await db
        .insert(repos)
        .values(row)
        .onConflictDoUpdate({
          target: repos.githubId,
          set: {
            fullName: row.fullName,
            owner: row.owner,
            name: row.name,
            description: row.description,
            htmlUrl: row.htmlUrl,
            homepage: row.homepage,
            avatarUrl: row.avatarUrl,
            language: row.language,
            topics: row.topics,
            license: row.license,
            stars: row.stars,
            forks: row.forks,
            watchers: row.watchers,
            openIssues: row.openIssues,
            defaultBranch: row.defaultBranch,
            isArchived: row.isArchived,
            repoPushedAt: row.repoPushedAt,
            ingestedAt: row.ingestedAt,
          },
        })
        .returning({ id: repos.id });

      await db.insert(repoSnapshots).values({
        repoId: upserted.id,
        stars: row.stars,
        forks: row.forks,
        openIssues: row.openIssues,
        watchers: row.watchers,
      });
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
