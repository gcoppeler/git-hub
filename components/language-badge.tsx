import { getLanguageColor } from "@/lib/language-colors";

export function LanguageBadge({ language }: { language: string | null }) {
  if (!language) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: getLanguageColor(language) }}
      />
      {language}
    </span>
  );
}
