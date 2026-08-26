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
