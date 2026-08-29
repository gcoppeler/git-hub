import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { repoActivity, repoSnapshots, repos } from "@/lib/db/schema";
import {
  getCommitActivityWeeks,
  getContributorCount,
  getPullRequestCounts,
  getSubscriberCount,
} from "@/lib/github";

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export type RepoActivity = typeof repoActivity.$inferSelect;

export interface ActivityResult {
  activity: RepoActivity | null;
  /** True when GitHub is still computing commit/contributor stats server-side (202). */
  computing: boolean;
}

/**
 * Commit/contributor/PR activity changes constantly, so unlike releases this
 * is cached with a TTL rather than "fetch once forever". GitHub's stats
 * endpoints can also return 202 while it computes them in the background for
 * a repo that's never been queried before — in that case we keep any
 * previously cached row (if any) and flag `computing: true` so the UI can
 * show a "check back shortly" hint instead of a false zero.
 */
export async function getActivityForRepo(
  repoId: number,
  owner: string,
  name: string,
): Promise<ActivityResult> {
  const db = getDb();
  const [cached] = await db
    .select()
    .from(repoActivity)
    .where(eq(repoActivity.repoId, repoId))
    .limit(1);

  const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;
  if (isFresh) return { activity: cached, computing: false };

  // Any of these can fail independently (rate limits, transient GitHub
  // errors, etc.) — use allSettled so one flaky endpoint can't take down the
  // whole page. Failed calls fall back to the previously cached value.
  const [commitWeeksResult, contributorCountResult, prCountsResult, subscriberCountResult] =
    await Promise.allSettled([
      getCommitActivityWeeks(owner, name),
      getContributorCount(owner, name),
      getPullRequestCounts(owner, name),
      getSubscriberCount(owner, name),
    ]);

  const commitWeeks = commitWeeksResult.status === "fulfilled" ? commitWeeksResult.value : null;
  const contributorCount =
    contributorCountResult.status === "fulfilled" ? contributorCountResult.value : null;
  const prCounts = prCountsResult.status === "fulfilled" ? prCountsResult.value : null;
  const subscriberCount =
    subscriberCountResult.status === "fulfilled" ? subscriberCountResult.value : null;

  const stillComputing = commitWeeks === null || contributorCount === null;
  if (stillComputing && !cached) {
    return { activity: null, computing: true };
  }

  const row = {
    repoId,
    commitsLast4Weeks: commitWeeks ? sum(commitWeeks.slice(-4)) : cached?.commitsLast4Weeks ?? 0,
    commitsLast12Weeks: commitWeeks
      ? sum(commitWeeks.slice(-12))
      : cached?.commitsLast12Weeks ?? 0,
    contributorCount: contributorCount ?? cached?.contributorCount ?? 0,
    openPullRequests: prCounts?.open ?? cached?.openPullRequests ?? 0,
    mergedPullRequestsLast30d: prCounts?.mergedLast30d ?? cached?.mergedPullRequestsLast30d ?? 0,
    subscriberCount: subscriberCount ?? cached?.subscriberCount ?? 0,
    fetchedAt: new Date(),
  };

  const [saved] = await db
    .insert(repoActivity)
    .values(row)
    .onConflictDoUpdate({ target: repoActivity.repoId, set: row })
    .returning();

  // Opportunistically capture a real historical "watchers" (subscribers_count)
  // data point whenever we actually made a fresh call for it — this reuses
  // the per-repo GitHub request above instead of adding a new one, so it's
  // free from a rate-limit perspective. This only happens when a repo detail
  // page is viewed (and the 12h TTL has expired), so history accumulates
  // gradually rather than on every daily bulk ingestion run. See the
  // `subscriberCount` column comment in lib/db/schema.ts.
  if (subscriberCountResult.status === "fulfilled") {
    const [repoRow] = await db
      .select({ stars: repos.stars, forks: repos.forks, openIssues: repos.openIssues, watchers: repos.watchers })
      .from(repos)
      .where(eq(repos.id, repoId))
      .limit(1);

    if (repoRow) {
      await db.insert(repoSnapshots).values({
        repoId,
        stars: repoRow.stars,
        forks: repoRow.forks,
        openIssues: repoRow.openIssues,
        watchers: repoRow.watchers,
        subscriberCount: subscriberCountResult.value,
      });
    }
  }

  return { activity: saved, computing: stillComputing };
}
