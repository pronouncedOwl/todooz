/** App calendar timezone for habit day boundaries and export “today”. */
export const DEFAULT_TIMEZONE = "America/Chicago";

export function appTimezone() {
  const raw = process.env.TODOOZ_TIMEZONE;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return DEFAULT_TIMEZONE;
}

/**
 * Calendar date (YYYY-MM-DD) for `now` in the app timezone.
 * Defaults to America/Chicago so Vercel UTC does not shift late-night CT checkoffs.
 */
export function todayISO(now = new Date(), timeZone = appTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error(`Could not format date for timezone ${timeZone}`);
  }
  return `${y}-${m}-${d}`;
}

/** Weekday code (SU…SA) for `now` in the app timezone. */
export function weekdayCode(now = new Date(), timeZone = appTimezone()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(now);
  const map = {
    Sun: "SU",
    Mon: "MO",
    Tue: "TU",
    Wed: "WE",
    Thu: "TH",
    Fri: "FR",
    Sat: "SA",
  };
  return map[weekday] || "MO";
}

/** Hour of day (0–23) for `now` in the app timezone. */
export function hourInAppTimezone(now = new Date(), timeZone = appTimezone()) {
  return Math.floor(clockMinutesInAppTimezone(now, timeZone) / 60);
}

/** Minutes since midnight (0–1439) for `now` in the app timezone. */
export function clockMinutesInAppTimezone(now = new Date(), timeZone = appTimezone()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * Habit groups that prompt at a cutoff. Before bed stays open until the
 * calendar day rolls over, when leftover opens become incomplete.
 */
export const HABIT_CLOSEOUT_BLOCKS = [
  { id: "before_wake", label: "Before wake", hour: 6, minute: 15 },
  { id: "morning", label: "Morning", hour: 11, minute: 0 },
  { id: "daytime", label: "Daytime", hour: 15, minute: 0 },
  { id: "evening", label: "Evening", hour: 20, minute: 30 },
];

const CLOSEOUT_BY_ID = new Map(
  HABIT_CLOSEOUT_BLOCKS.map((block) => [block.id, block]),
);

/** Morning habit block ends at this hour (America/Chicago by default). */
export const MORNING_CUTOFF_HOUR = 11;

export function habitBlockCutoffMinutes(blockId) {
  const block = CLOSEOUT_BY_ID.get(blockId);
  if (!block) return null;
  return block.hour * 60 + block.minute;
}

export function isPastHabitBlockCutoff(
  blockId,
  now = new Date(),
  timeZone = appTimezone(),
) {
  const cutoff = habitBlockCutoffMinutes(blockId);
  if (cutoff == null) return false;
  return clockMinutesInAppTimezone(now, timeZone) >= cutoff;
}

export function isPastMorningCutoff(now = new Date(), timeZone = appTimezone()) {
  return isPastHabitBlockCutoff("morning", now, timeZone);
}

export function formatHabitBlockCutoff(blockId) {
  const block = CLOSEOUT_BY_ID.get(blockId);
  if (!block) return "";
  const date = new Date(2000, 0, 1, block.hour, block.minute);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
