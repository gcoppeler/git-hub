const GITHUB_API = "https://api.github.com";

export interface GitHubSearchRepoItem {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string };
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  license: { spdx_id: string } | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  default_branch: string;
  archived: boolean;
  created_at: string;
  pushed_at: string;
}

interface SearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchRepoItem[];
}

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string | null;
}

class GitHubApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-insights-dashboard",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubApiError(
      `GitHub API request failed (${res.status}) for ${path}: ${body.slice(0, 300)}`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The GitHub Search API is rate limited to 30 requests/minute for
 * authenticated requests, far tighter than the 5,000/hour core limit.
 * Space calls out to stay comfortably under that ceiling.
 */
export async function searchRepositories(
  query: string,
  { perPage = 100, page = 1 }: { perPage?: number; page?: number } = {},
): Promise<GitHubSearchRepoItem[]> {
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(perPage),
    page: String(page),
  });
  const data = await githubFetch<SearchResponse>(
    `/search/repositories?${params.toString()}`,
  );
  return data.items;
}

export async function listReleases(
  owner: string,
  repo: string,
  perPage = 10,
): Promise<GitHubRelease[]> {
  try {
    return await githubFetch<GitHubRelease[]>(
      `/repos/${owner}/${repo}/releases?per_page=${perPage}`,
    );
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return [];
    throw error;
  }
}

interface CommitActivityWeek {
  week: number;
  total: number;
  days: number[];
}

/**
 * Returns weekly commit totals for the last 52 weeks, oldest first, or `null`
 * if GitHub hasn't finished computing the stats yet (a 202 while it caches
 * the result in the background — the caller should retry later rather than
 * treat this as "zero commits").
 */
export async function getCommitActivityWeeks(
  owner: string,
  repo: string,
): Promise<number[] | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stats/commit_activity`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  // GitHub's stats endpoints compute results in the background and can
  // return 202 while that's in progress. For very large repos they've also
  // been observed returning a transient 5xx during that same computation
  // window — treat both the same way ("try again later") rather than
  // throwing and taking down the whole page over a flaky upstream response.
  if (res.status === 202 || res.status >= 500) return null;
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new GitHubApiError(`Commit activity request failed (${res.status})`, res.status);
  }
  const weeks = (await res.json()) as CommitActivityWeek[];
  return Array.isArray(weeks) ? weeks.map((week) => week.total) : [];
}

/**
 * Returns the contributor count, or `null` if GitHub is still computing it
 * (same 202/transient-5xx-while-caching behavior as commit activity).
 */
export async function getContributorCount(owner: string, repo: string): Promise<number | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/stats/contributors`, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (res.status === 202 || res.status >= 500) return null;
  if (res.status === 404) return 0;
  if (!res.ok) {
    throw new GitHubApiError(`Contributors request failed (${res.status})`, res.status);
  }
  const contributors = await res.json();
  return Array.isArray(contributors) ? contributors.length : 0;
}

export interface PullRequestCounts {
  open: number;
  mergedLast30d: number;
}

export async function getPullRequestCounts(
  owner: string,
  repo: string,
): Promise<PullRequestCounts> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [openResult, mergedResult] = await Promise.all([
    githubFetch<{ total_count: number }>(
      `/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} is:pr is:open`)}&per_page=1`,
    ),
    githubFetch<{ total_count: number }>(
      `/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo} is:pr is:merged merged:>=${since}`,
      )}&per_page=1`,
    ),
  ]);
  return { open: openResult.total_count, mergedLast30d: mergedResult.total_count };
}

/**
 * GitHub's `watchers_count` field (available on search results and used for
 * bulk ingestion) is a deprecated alias that always mirrors `stargazers_count`.
 * The real "people watching for notifications" count is `subscribers_count`,
 * which only exists on the single-repo endpoint — so it can't be picked up
 * during bulk search-based ingestion and has to be fetched per repo.
 */
export async function getSubscriberCount(owner: string, repo: string): Promise<number> {
  try {
    const data = await githubFetch<{ subscribers_count: number }>(`/repos/${owner}/${repo}`);
    return data.subscribers_count;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return 0;
    throw error;
  }
}

export { GitHubApiError };
