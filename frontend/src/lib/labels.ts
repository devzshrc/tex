export const LABEL_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/**
 * Static class literals per color (Tailwind can't see dynamic strings).
 * Bars for card rows, soft pills for names.
 */
export const LABEL_STYLES: Record<LabelColor, { bar: string; soft: string; dot: string }> = {
  red: { bar: "bg-red-500", soft: "bg-red-500/15 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  orange: { bar: "bg-orange-500", soft: "bg-orange-500/15 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  yellow: { bar: "bg-yellow-500", soft: "bg-yellow-500/20 text-yellow-800 dark:text-yellow-200", dot: "bg-yellow-500" },
  green: { bar: "bg-green-500", soft: "bg-green-500/15 text-green-700 dark:text-green-300", dot: "bg-green-500" },
  teal: { bar: "bg-teal-500", soft: "bg-teal-500/15 text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  blue: { bar: "bg-blue-500", soft: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  purple: { bar: "bg-purple-500", soft: "bg-purple-500/15 text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  pink: { bar: "bg-pink-500", soft: "bg-pink-500/15 text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
  gray: { bar: "bg-gray-500", soft: "bg-gray-500/15 text-gray-700 dark:text-gray-300", dot: "bg-gray-500" },
};

export function labelStyle(color: string): { bar: string; soft: string; dot: string } {
  return (LABEL_STYLES as Record<string, { bar: string; soft: string; dot: string }>)[color] ?? LABEL_STYLES.gray;
}
