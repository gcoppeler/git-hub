/** A pragmatic subset of GitHub's linguist language colors, used for chart series and badges. */
export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  Go: "#00ADD8",
  Rust: "#dea584",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4F5D95",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Scala: "#c22d40",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  Lua: "#000080",
  R: "#198CE7",
};

const FALLBACK_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#a4de6c",
  "#d0ed57",
];

export function getLanguageColor(language: string | null, index = 0): string {
  if (language && LANGUAGE_COLORS[language]) return LANGUAGE_COLORS[language];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}
