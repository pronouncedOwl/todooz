/** Preset ballpark estimates for planning — not time tracking. */
export const ESTIMATE_OPTIONS = [
  { minutes: 5, label: "5m" },
  { minutes: 10, label: "10m" },
  { minutes: 15, label: "15m" },
  { minutes: 20, label: "20m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
  { minutes: 240, label: "4h" },
  { minutes: 360, label: "6h" },
];

/** Normalize raw input to a positive whole number of minutes, or null. */
export function normalizeEstimateMinutes(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("estimate_minutes must be a positive integer");
  }
  return n;
}

/** Short label for a minutes value, e.g. 90 → "~1.5h", 45 → "~45m". */
export function formatEstimate(minutes) {
  if (minutes == null || minutes <= 0) return null;
  const preset = ESTIMATE_OPTIONS.find((o) => o.minutes === minutes);
  if (preset) return preset.label;
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

/** Sum incomplete todos' estimates; returns null if none have estimates. */
export function remainingEstimateMinutes(todos) {
  let total = 0;
  let any = false;
  for (const t of todos ?? []) {
    if (t.completed) continue;
    if (t.estimate_minutes == null) continue;
    total += Number(t.estimate_minutes) || 0;
    any = true;
  }
  return any ? total : null;
}

export function formatRemainingEstimate(todos) {
  const mins = remainingEstimateMinutes(todos);
  if (mins == null) return null;
  const label = formatEstimate(mins);
  return label ? `~${label} left` : null;
}
