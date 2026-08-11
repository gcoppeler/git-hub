# GitHub Insights

A dashboard of statistics and trends for a curated set of the most popular public GitHub
repositories — top repos overall, top repos per language, star/fork growth over time, and release
history.

Since GitHub has 100M+ public repositories, "all of them" isn't realistically queryable live
(GitHub's Search API is capped at 30 requests/minute for authenticated users, 1,000 results per
query). Instead, this app tracks a **trending set**: the top ~300 repos by stars overall, plus the
top 50 per tracked language (`lib/ingest.ts`), refreshed daily via a Vercel Cron Job. That's roughly
1,000–1,200 unique repos, which is enough to power meaningful leaderboards, language breakdowns,
and growth trends without hitting rate limits.

## Stack

- **Next.js 16** (App Router, Server Components, Turbopack)
- **shadcn/ui** + Tailwind CSS v4, dark mode by default
- **Recharts** (via shadcn's `chart` wrapper) for the star-history and language charts
- **Drizzle ORM** + **Neon Postgres** (serverless HTTP driver)
- **Vercel Cron Jobs** for periodic ingestion from the GitHub REST/Search API

## How data flows

1. **Ingestion** (`lib/ingest.ts`, run by `app/api/cron/ingest/route.ts` or `npm run ingest`)
   queries GitHub's Search API for the overall top-starred repos and the top repos per tracked
   language, then upserts them into the `repos` table and appends a row to `repo_snapshots` for
   every repo on every run — this is what powers the "fastest growing" leaderboard (it diffs
   today's star count against the snapshot closest to 7 days ago).
2. **Releases** (`lib/releases.ts`) are fetched lazily and cached: the first time a repo's detail
   page is visited, its releases are pulled from GitHub and stored in the `releases` table; later
   visits read from the cache.
3. **The dashboard** (`app/page.tsx`, `app/repos/`) reads everything from Postgres via
   `lib/queries.ts` — it never calls the GitHub API directly on a page request, so page loads are
   fast and don't consume API rate limit.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision Postgres

Recommended: install the **Neon** integration from the [Vercel Marketplace](https://vercel.com/marketplace)
on a linked Vercel project, then pull the auto-provisioned connection string:

```bash
vercel link
vercel env pull .env.local
```

Alternatively, create a free database directly at [neon.tech](https://neon.tech) and set
`DATABASE_URL` in `.env.local` yourself (copy `.env.example` as a starting point).

### 3. Create a GitHub token (recommended, not required)

Unauthenticated requests are limited to 60/hour (core) and 10/minute (search) — enough to browse,
but not enough for the ingestion job's ~25 search calls per run. Create a classic token with no
scopes at <https://github.com/settings/tokens> (public data only needs zero scopes) and set it as
`GITHUB_TOKEN` in `.env.local`.

### 4. Create the database tables

```bash
npm run db:push
```

### 5. Run the first ingestion

```bash
npm run ingest
```

This takes 1–2 minutes (it deliberately paces requests to stay under GitHub's Search API rate
limit). Re-run it any time to refresh data locally — each run also appends a snapshot, so growth
trends need a few runs spread over days to become meaningful.

### 6. Start the app

```bash
npm run dev
```

Visit <http://localhost:3000>.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel, or run `vercel deploy`.
2. Install the Neon Marketplace integration on the project (if you haven't already) so
   `DATABASE_URL` is set in the Vercel project's environment variables.
3. Set `GITHUB_TOKEN` and `CRON_SECRET` (any random string) in **Project Settings → Environment
   Variables**.
4. Deploy. `vercel.json` registers a daily cron job (`/api/cron/ingest`, `23 6 * * *` UTC) — Vercel
   automatically sends `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests, which the
   route checks against `process.env.CRON_SECRET`.
5. Trigger the first ingestion manually (cron jobs only run on production deployments, and only on
   their schedule): `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/ingest`,
   or run `npm run ingest` locally against the production `DATABASE_URL`.

> Hobby plan cron jobs run at most once/day, which matches this project's "periodic refresh" design
> goal. Upgrade to Pro if you want finer-grained scheduling.

## Project structure

```
app/
  page.tsx                        Overview: KPIs, language chart, leaderboards
  repos/page.tsx                  Browsable, filterable, sortable repo list
  repos/[owner]/[name]/page.tsx   Repo detail: star history, metadata, releases
  api/cron/ingest/route.ts        Cron-triggered ingestion endpoint
lib/
  github.ts                       Server-only GitHub REST/Search API client
  ingest.ts                       Ingestion pipeline (search → upsert → snapshot)
  releases.ts                     Lazy, cached release fetching
  queries.ts                      All read queries used by the UI
  db/schema.ts                    Drizzle schema (repos, repo_snapshots, releases, ingestion_runs)
components/                       Dashboard UI (tables, charts, cards) built on shadcn/ui
scripts/ingest.ts                 CLI entry point for `npm run ingest`
```

## Extending the tracked set

Edit `TRACKED_LANGUAGES`, `OVERALL_PAGES`, or `PER_LANGUAGE_RESULTS` in `lib/ingest.ts`. Keep an eye
on `SEARCH_DELAY_MS` — the Search API's 30 req/min limit is the binding constraint, not GitHub's
5,000/hour core REST limit.
