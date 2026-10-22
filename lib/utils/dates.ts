/** UTC date helpers used by reports. All persisted timestamps are ISO UTC. */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseDateOnly(value: string): Date | null {
  if (!isDateOnly(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(now = new Date()): string {
  return formatDateOnly(now);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(startOfUtcDay(date), delta);
}

export function eachUtcDay(from: Date, toExclusive: Date): Date[] {
  const days: Date[] = [];
  for (let cursor = startOfUtcDay(from); cursor < toExclusive; cursor = addDays(cursor, 1)) {
    days.push(cursor);
    if (days.length > 400) break;
  }
  return days;
}

export function eachUtcWeek(from: Date, toExclusive: Date): Date[] {
  const weeks: Date[] = [];
  for (let cursor = startOfUtcWeek(from); cursor < toExclusive; cursor = addDays(cursor, 7)) {
    weeks.push(cursor);
    if (weeks.length > 60) break;
  }
  return weeks;
}

export function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}
