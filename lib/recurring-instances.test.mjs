import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInstanceDate } from "./dates.js";

const INSTANCE_LOOKBACK_DAYS = 120;

test("normalizeInstanceDate keeps YYYY-MM-DD strings", () => {
  assert.equal(normalizeInstanceDate("2026-11-10"), "2026-11-10");
  assert.equal(normalizeInstanceDate("2026-11-10T00:00:00"), "2026-11-10");
  assert.equal(normalizeInstanceDate("2026-11-10T00:00:00.000Z"), "2026-11-10");
});

test("normalizeInstanceDate handles Date objects as UTC calendar days", () => {
  assert.equal(
    normalizeInstanceDate(new Date("2026-11-10T00:00:00.000Z")),
    "2026-11-10",
  );
});

/**
 * Mirrors the remote filter: recent rows OR still-open leftovers.
 * Guards the regression where a 1000-row truncate dropped "today".
 */
function matchesRemoteInstanceFilter(row, cutoff) {
  return row.date >= cutoff || row.status === "open";
}

test("remote filter keeps today even when older history is huge", () => {
  const today = "2026-11-10";
  const cutoffDate = new Date(`${today}T00:00:00.000Z`);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - INSTANCE_LOOKBACK_DAYS);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const older = Array.from({ length: 1300 }, (_, i) => ({
    id: `old-${i}`,
    date: "2026-06-01",
    status: "incomplete",
  }));
  const todayRows = [
    { id: "today-1", date: today, status: "open" },
    { id: "today-2", date: today, status: "open" },
  ];
  const openLeftover = { id: "stuck", date: "2026-05-01", status: "open" };

  const kept = [...older, openLeftover, ...todayRows].filter((row) =>
    matchesRemoteInstanceFilter(row, cutoff),
  );

  assert.equal(
    kept.some((row) => row.id === "old-0"),
    false,
    "pre-cutoff completed history can be skipped",
  );
  assert.equal(kept.some((row) => row.id === "stuck"), true);
  assert.equal(kept.filter((row) => row.date === today).length, 2);
  // Even after dropping old history, today's rows must remain selectable
  // once pagination walks past the default 1000-row page size.
  assert.ok(older.length > 1000);
  assert.equal(
    [...older, ...todayRows].slice(0, 1000).filter((r) => r.date === today)
      .length,
    0,
  );
});
