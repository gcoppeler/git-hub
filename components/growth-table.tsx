import { TrendingUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LanguageBadge } from "@/components/language-badge";
import { RepoIdentity } from "@/components/repo-identity";
import { formatCompactNumber } from "@/lib/format";
import type { FastestGrowingRow } from "@/lib/queries";

export function GrowthTable({ rows, windowDays }: { rows: FastestGrowingRow[]; windowDays: number }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Growth data appears after the ingestion job has run for a few days.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Repository</TableHead>
          <TableHead>Language</TableHead>
          <TableHead className="text-right">Stars</TableHead>
          <TableHead className="text-right">Growth ({windowDays}d)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.id}>
            <TableCell className="text-muted-foreground">{index + 1}</TableCell>
            <TableCell>
              <RepoIdentity owner={row.owner} name={row.name} avatarUrl={row.avatarUrl} />
            </TableCell>
            <TableCell>
              <LanguageBadge language={row.language} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCompactNumber(row.stars)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-[oklch(0.723_0.219_149.579)]">
              <span className="inline-flex items-center justify-end gap-1">
                <TrendingUp className="h-3.5 w-3.5" />+{formatCompactNumber(row.starGrowth)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
