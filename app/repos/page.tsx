import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { SetupRequired } from "@/components/setup-required";
import { EmptyDataset } from "@/components/empty-dataset";
import {
  getDistinctLanguages,
  getOverviewStats,
  listRepos,
  type RepoSort,
} from "@/lib/queries";

export const revalidate = 300;

const SORT_OPTIONS: { value: RepoSort; label: string }[] = [
  { value: "stars", label: "Most stars" },
  { value: "forks", label: "Most forks" },
  { value: "open_issues", label: "Most open issues" },
  { value: "recently_pushed", label: "Recently pushed" },
];

const PAGE_SIZE = 30;

interface ReposPageProps {
  searchParams: Promise<{
    language?: string;
    sort?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function ReposPage({ searchParams }: ReposPageProps) {
  if (!process.env.DATABASE_URL) {
    return <SetupRequired />;
  }

  const params = await searchParams;
  const language = params.language && params.language !== "all" ? params.language : undefined;
  const sort = (SORT_OPTIONS.some((o) => o.value === params.sort) ? params.sort : "stars") as RepoSort;
  const search = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const stats = await getOverviewStats();
  if (stats.repoCount === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyDataset />
      </div>
    );
  }

  const [languages, rows] = await Promise.all([
    getDistinctLanguages(),
    listRepos({ language, sort, search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Browse repositories</h1>
        <p className="text-sm text-muted-foreground">
          {stats.repoCount.toLocaleString()} repositories tracked across {stats.languageCount}{" "}
          languages.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]" action="/repos">
            <Input
              type="text"
              name="q"
              placeholder="Search by name (e.g. next.js)"
              defaultValue={search}
            />
            <Select name="language" defaultValue={language ?? "all"}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="sort" defaultValue={sort}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length > 0 ? (
            <LeaderboardTable repos={rows} startRank={(page - 1) * PAGE_SIZE + 1} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No repositories match those filters.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={`/repos?${new URLSearchParams({
                ...(language ? { language } : {}),
                ...(search ? { q: search } : {}),
                sort,
                page: String(page - 1),
              }).toString()}`}
            >
              Previous
            </a>
          </Button>
        ) : null}
        {rows.length === PAGE_SIZE ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={`/repos?${new URLSearchParams({
                ...(language ? { language } : {}),
                ...(search ? { q: search } : {}),
                sort,
                page: String(page + 1),
              }).toString()}`}
            >
              Next
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
