import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    fullName: text("full_name").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    htmlUrl: text("html_url").notNull(),
    homepage: text("homepage"),
    avatarUrl: text("avatar_url"),
    language: text("language"),
    topics: text("topics").array().notNull().default([]),
    license: text("license"),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    watchers: integer("watchers").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),
    defaultBranch: text("default_branch"),
    isArchived: boolean("is_archived").notNull().default(false),
    repoCreatedAt: timestamp("repo_created_at", { withTimezone: true }),
    repoPushedAt: timestamp("repo_pushed_at", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("repos_github_id_idx").on(table.githubId),
    uniqueIndex("repos_full_name_idx").on(table.fullName),
    index("repos_language_idx").on(table.language),
    index("repos_stars_idx").on(table.stars),
  ],
);

export const repoSnapshots = pgTable(
  "repo_snapshots",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    stars: integer("stars").notNull(),
    forks: integer("forks").notNull(),
    openIssues: integer("open_issues").notNull(),
    watchers: integer("watchers").notNull(),
  },
  (table) => [
    index("repo_snapshots_repo_id_idx").on(table.repoId),
    index("repo_snapshots_captured_at_idx").on(table.capturedAt),
  ],
);

export const releases = pgTable(
  "releases",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    tagName: text("tag_name").notNull(),
    name: text("name"),
    htmlUrl: text("html_url").notNull(),
    isPrerelease: boolean("is_prerelease").notNull().default(false),
    isDraft: boolean("is_draft").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("releases_repo_tag_idx").on(table.repoId, table.tagName),
    index("releases_repo_id_idx").on(table.repoId),
  ],
);

export const repoActivity = pgTable(
  "repo_activity",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    commitsLast4Weeks: integer("commits_last_4_weeks").notNull().default(0),
    commitsLast12Weeks: integer("commits_last_12_weeks").notNull().default(0),
    contributorCount: integer("contributor_count").notNull().default(0),
    openPullRequests: integer("open_pull_requests").notNull().default(0),
    mergedPullRequestsLast30d: integer("merged_pull_requests_last_30d")
      .notNull()
      .default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("repo_activity_repo_id_idx").on(table.repoId)],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  reposUpserted: integer("repos_upserted").notNull().default(0),
  errorMessage: text("error_message"),
});
