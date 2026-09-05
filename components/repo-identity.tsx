import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function RepoIdentity({
  owner,
  name,
  avatarUrl,
  description,
  htmlUrl,
}: {
  owner: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  /** When set, shows a link out to the repo on github.com. */
  htmlUrl?: string | null;
}) {
  const githubUrl = htmlUrl ?? `https://github.com/${owner}/${name}`;

  return (
    <div className="flex items-center gap-2">
      <Link href={`/repos/${owner}/${name}`} className="group flex min-w-0 flex-1 items-center gap-3">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={owner}
            width={32}
            height={32}
            className="shrink-0 rounded-md"
          />
        ) : (
          <div className="h-8 w-8 shrink-0 rounded-md bg-muted" />
        )}
        <div className="min-w-0">
          <div className="truncate font-medium group-hover:underline">
            {owner}/{name}
          </div>
          {description ? (
            <div className="max-w-md truncate text-xs text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </Link>
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${owner}/${name} on GitHub`}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
