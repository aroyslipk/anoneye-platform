/** Minimal class-name joiner (no dependency). */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
