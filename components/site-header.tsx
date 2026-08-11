import Link from "next/link";
import { GitBranch } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <GitBranch className="h-5 w-5" />
          GitHub Insights
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            Overview
          </Link>
          <Link href="/repos" className="transition-colors hover:text-foreground">
            Browse
          </Link>
        </nav>
      </div>
    </header>
  );
}
