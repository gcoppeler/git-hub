import Link from "next/link";
import { cn } from "@/lib/utils";

export const GROWTH_WINDOWS = [7, 30, 90] as const;
export type GrowthWindow = (typeof GROWTH_WINDOWS)[number];

export function parseGrowthWindow(value: string | undefined): GrowthWindow {
  const parsed = Number(value);
  return (GROWTH_WINDOWS as readonly number[]).includes(parsed)
    ? (parsed as GrowthWindow)
    : 7;
}

export function GrowthWindowToggle({ active }: { active: GrowthWindow }) {
  return (
    <div className="inline-flex items-center rounded-md border border-border p-0.5 text-xs">
      {GROWTH_WINDOWS.map((days) => (
        <Link
          key={days}
          href={days === 7 ? "/" : `/?window=${days}`}
          className={cn(
            "rounded-sm px-2.5 py-1 transition-colors",
            active === days
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}
