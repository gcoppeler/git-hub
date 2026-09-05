import { CircleAlert, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LanguageBadge } from "@/components/language-badge";
import { RepoIdentity } from "@/components/repo-identity";
import { formatCompactNumber } from "@/lib/format";
import type { repos } from "@/lib/db/schema";

type Repo = typeof repos.$inferSelect;

export function LeaderboardTable({
  repos,
  startRank = 1,
}: {
  repos: Repo[];
  /** 1-based rank of the first row — used so browse pagination keeps counting across pages. */
  startRank?: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Repository</TableHead>
          <TableHead>Language</TableHead>
          <TableHead className="text-right">Stars</TableHead>
          <TableHead className="text-right">Forks</TableHead>
          <TableHead className="text-right">Open issues</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repos.map((repo, index) => (
          <TableRow key={repo.id}>
            <TableCell className="text-muted-foreground">{startRank + index}</TableCell>
            <TableCell>
              <RepoIdentity
                owner={repo.owner}
                name={repo.name}
                avatarUrl={repo.avatarUrl}
                description={repo.description}
                htmlUrl={repo.htmlUrl}
              />
            </TableCell>
            <TableCell>
              <LanguageBadge language={repo.language} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="inline-flex items-center justify-end gap-1">
                <Star className="h-3.5 w-3.5 text-muted-foreground" />
                {formatCompactNumber(repo.stars)}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {formatCompactNumber(repo.forks)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              <span className="inline-flex items-center justify-end gap-1">
                <CircleAlert className="h-3.5 w-3.5" />
                {formatCompactNumber(repo.openIssues)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
