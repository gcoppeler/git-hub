import Image from "next/image";
import Link from "next/link";

export function RepoIdentity({
  owner,
  name,
  avatarUrl,
  description,
}: {
  owner: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
}) {
  return (
    <Link href={`/repos/${owner}/${name}`} className="group flex items-center gap-3">
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
  );
}
