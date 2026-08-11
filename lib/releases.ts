import { getDb } from "@/lib/db";
import { releases as releasesTable } from "@/lib/db/schema";
import { getRepoReleases } from "@/lib/queries";
import { listReleases } from "@/lib/github";

/**
 * Release history changes far less often than star counts, so we cache it in
 * Postgres and only hit the GitHub REST API the first time a repo's detail
 * page is viewed (or after the cache is cleared by a future re-ingestion).
 */
export async function getReleasesForRepo(repoId: number, owner: string, name: string) {
  const cached = await getRepoReleases(repoId);
  if (cached.length > 0) return cached;

  const fetched = await listReleases(owner, name, 10);
  if (fetched.length === 0) return [];

  const db = getDb();
  await db
    .insert(releasesTable)
    .values(
      fetched.map((release) => ({
        repoId,
        tagName: release.tag_name,
        name: release.name,
        htmlUrl: release.html_url,
        isPrerelease: release.prerelease,
        isDraft: release.draft,
        publishedAt: release.published_at ? new Date(release.published_at) : null,
      })),
    )
    .onConflictDoNothing();

  return getRepoReleases(repoId);
}
