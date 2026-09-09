import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { normalizeEstimateMinutes } from "@/lib/estimates";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export { todayISO } from "@/lib/dates";

const DATA_PATH = path.join(process.cwd(), "data", "recurring.json");

const WEEKDAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const WEEKDAY_CODES = new Set(["SU", "MO", "TU", "WE", "TH", "FR", "SA"]);
export const TIME_OF_DAY = new Set(["morning", "daytime", "evening"]);
const VALID_INSTANCE_STATUS = new Set([
  "open",
  "incomplete",
  "completed",
  "skipped",
]);

/** Resolve which time-of-day section an occurrence belongs to. */
export function slotForOccurrence(template, occurrence) {
  const times = Math.max(1, Number(template.times_per_day) || 1);
  const slots = Array.isArray(template.time_slots) ? template.time_slots : null;
  const fallback = TIME_OF_DAY.has(template.time_of_day)
    ? template.time_of_day
    : "daytime";
  if (slots && slots.length > 0) {
    const idx = Math.max(0, Math.min(times, Number(occurrence) || 1) - 1);
    const slot = slots[idx] ?? slots[slots.length - 1] ?? fallback;
    return TIME_OF_DAY.has(slot) ? slot : fallback;
  }
  return fallback;
}

function normalizeTimeOfDay(value) {
  const raw = String(value ?? "daytime").toLowerCase();
  return TIME_OF_DAY.has(raw) ? raw : "daytime";
}

function normalizeTimeSlots(input, timesPerDay, fallback) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const times = Math.max(1, Number(timesPerDay) || 1);
  const slots = [];
  for (let i = 0; i < times; i++) {
    const raw = input[i] ?? input[input.length - 1] ?? fallback;
    slots.push(normalizeTimeOfDay(raw));
  }
  // Collapse to null when every slot matches the single time_of_day.
  if (slots.every((s) => s === fallback)) return null;
  return slots;
}

function supabaseEnabled() {
  return isSupabaseConfigured();
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function daysBetween(aISO, bISO) {
  const a = parseISODate(aISO);
  const b = parseISODate(bISO);
  return Math.round((b - a) / 86400000);
}

export function occursOn(template, dateISO) {
  const date = parseISODate(dateISO);
  const freq = template.freq || "DAILY";
  const interval = Math.max(1, Number(template.interval) || 1);

  if (freq === "WEEKLY") {
    const days = Array.isArray(template.byweekday) ? template.byweekday : [];
    if (days.length === 0) return false;
    const weekday = date.getDay();
    return days.some((code) => WEEKDAY_INDEX[code] === weekday);
  }

  // DAILY
  if (interval <= 1) return true;
  const anchor = template.anchor || dateISO;
  if (dateISO < anchor) return false;
  const delta = daysBetween(anchor, dateISO);
  return delta % interval === 0;
}

/** Stable id so toggles survive regenerate / refresh. */
export function instanceId(templateId, date, occurrence) {
  return `${templateId}_${date}_${occurrence}`;
}

async function readLocalStore() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  return {
    templates: Array.isArray(data.templates) ? data.templates : [],
    instances: Array.isArray(data.instances) ? data.instances : [],
    prefs: {
      morning_closed_on:
        typeof data.prefs?.morning_closed_on === "string"
          ? data.prefs.morning_closed_on
          : null,
    },
  };
}

async function writeLocalStore(data) {
  const payload = {
    templates: data.templates,
    instances: data.instances,
    prefs: {
      morning_closed_on: data.prefs?.morning_closed_on ?? null,
    },
  };
  await fs.writeFile(DATA_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

/** Serialize local reads/writes so concurrent page loads don't clobber the file. */
let storeChain = Promise.resolve();

function withStoreLock(fn) {
  const run = storeChain.then(fn, fn);
  storeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function dayComplete(instancesForDay) {
  if (instancesForDay.length === 0) return false;
  return instancesForDay.every((i) => i.completed);
}

/** @returns {{ store: object, changed: boolean, created: object[], updated: object[] }} */
function syncStoreForToday(store, today) {
  let changed = false;
  const created = [];
  const updated = [];

  for (const inst of store.instances) {
    const stable = instanceId(inst.template_id, inst.date, inst.occurrence);
    let dirty = false;
    if (inst.id !== stable) {
      inst.id = stable;
      dirty = true;
    }

    if (inst.date < today && inst.status === "open") {
      inst.status = inst.completed ? "completed" : "incomplete";
      if (!inst.completed) inst.completed = false;
      dirty = true;
    }

    if (dirty) {
      changed = true;
      updated.push(inst);
    }
  }

  for (const template of store.templates) {
    if (!occursOn(template, today)) continue;
    const times = Math.max(1, Number(template.times_per_day) || 1);

    for (let occurrence = 1; occurrence <= times; occurrence++) {
      const id = instanceId(template.id, today, occurrence);
      const exists = store.instances.some(
        (i) =>
          i.id === id ||
          (i.template_id === template.id &&
            i.date === today &&
            i.occurrence === occurrence),
      );
      if (exists) continue;

      const row = {
        id,
        template_id: template.id,
        date: today,
        occurrence,
        completed: false,
        status: "open",
      };
      store.instances.push(row);
      created.push(row);
      changed = true;
    }
  }

  return { store, changed, created, updated };
}

/** Consecutive missed occurrence-days before `today` for a template. */
export function missStreak(template, instances, today) {
  let streak = 0;
  let cursor = addDaysISO(today, -1);

  for (let step = 0; step < 120; step++) {
    if (!occursOn(template, cursor)) {
      cursor = addDaysISO(cursor, -1);
      continue;
    }

    const forDay = instances.filter(
      (i) => i.template_id === template.id && i.date === cursor,
    );

    // No record yet (before app started tracking) — keep looking further back.
    if (forDay.length === 0) {
      cursor = addDaysISO(cursor, -1);
      continue;
    }

    if (!dayComplete(forDay)) {
      streak += 1;
      cursor = addDaysISO(cursor, -1);
      continue;
    }

    break;
  }

  return streak;
}

function normalizeTemplate(row) {
  let estimate_minutes = null;
  if (row.estimate_minutes != null && row.estimate_minutes !== "") {
    try {
      estimate_minutes = normalizeEstimateMinutes(row.estimate_minutes);
    } catch {
      estimate_minutes = null;
    }
  }
  const times_per_day = Number(row.times_per_day) || 1;
  const time_of_day = normalizeTimeOfDay(row.time_of_day);
  return {
    id: row.id,
    title: row.title,
    freq: row.freq,
    interval: Number(row.interval) || 1,
    times_per_day,
    byweekday: Array.isArray(row.byweekday) ? row.byweekday : null,
    anchor: row.anchor ?? null,
    notes: typeof row.notes === "string" ? row.notes : "",
    estimate_minutes,
    time_of_day,
    time_slots: normalizeTimeSlots(row.time_slots, times_per_day, time_of_day),
  };
}

function normalizeInstance(row) {
  const status = VALID_INSTANCE_STATUS.has(row.status) ? row.status : "open";
  return {
    id: row.id,
    template_id: row.template_id,
    date: row.date,
    occurrence: Number(row.occurrence) || 1,
    completed: Boolean(row.completed),
    status,
  };
}

async function readRemoteStore(userId, supabase) {
  const [templatesRes, instancesRes] = await Promise.all([
    supabase.from("recurring_templates").select("*").eq("user_id", userId),
    supabase.from("recurring_instances").select("*").eq("user_id", userId),
  ]);
  if (templatesRes.error) throw new Error(templatesRes.error.message);
  if (instancesRes.error) throw new Error(instancesRes.error.message);

  return {
    templates: (templatesRes.data ?? []).map(normalizeTemplate),
    instances: (instancesRes.data ?? []).map(normalizeInstance),
  };
}

async function persistRemoteSync(userId, supabase, { created, updated }) {
  if (updated.length > 0) {
    const rows = updated.map((inst) => ({
      id: inst.id,
      user_id: userId,
      template_id: inst.template_id,
      date: inst.date,
      occurrence: inst.occurrence,
      completed: Boolean(inst.completed),
      status: inst.status,
    }));
    const { error } = await supabase.from("recurring_instances").upsert(rows);
    if (error) throw new Error(error.message);
  }

  if (created.length > 0) {
    const rows = created.map((inst) => ({
      id: inst.id,
      user_id: userId,
      template_id: inst.template_id,
      date: inst.date,
      occurrence: inst.occurrence,
      completed: Boolean(inst.completed),
      status: inst.status,
    }));
    const { error } = await supabase.from("recurring_instances").upsert(rows);
    if (error) throw new Error(error.message);
  }
}

/**
 * Close past open instances as incomplete and ensure today's instances exist.
 * Safe to call on every page load.
 */
export async function ensureRecurringForToday(today = todayISO()) {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const store = await readRemoteStore(user.id, supabase);
    const { changed, created, updated } = syncStoreForToday(store, today);
    if (changed) await persistRemoteSync(user.id, supabase, { created, updated });
    return store;
  }

  return withStoreLock(async () => {
    const store = await readLocalStore();
    const { changed } = syncStoreForToday(store, today);
    if (changed) await writeLocalStore(store);
    return store;
  });
}

function displayTitle(template, occurrence, timesPerDay) {
  if (timesPerDay <= 1) return template.title;
  return `${template.title} (${occurrence}/${timesPerDay})`;
}

/** Today's recurring items, open first (sorted by miss streak), then completed. */
export async function getTodayRecurring(today = todayISO()) {
  const store = await ensureRecurringForToday(today);
  const templateById = new Map(store.templates.map((t) => [t.id, t]));

  const todays = store.instances
    .filter((i) => i.date === today)
    .map((inst) => {
      const template = templateById.get(inst.template_id);
      if (!template) return null;
      const times = Math.max(1, Number(template.times_per_day) || 1);
      const streak = missStreak(template, store.instances, today);
      return {
        id: inst.id,
        template_id: template.id,
        title: displayTitle(template, inst.occurrence, times),
        template_title: template.title,
        notes: template.notes || "",
        freq: template.freq,
        interval: template.interval,
        byweekday: template.byweekday,
        anchor: template.anchor,
        occurrence: inst.occurrence,
        times_per_day: times,
        date: inst.date,
        completed: Boolean(inst.completed),
        status: inst.status,
        miss_streak: streak,
        estimate_minutes: template.estimate_minutes ?? null,
        time_of_day: slotForOccurrence(template, inst.occurrence),
        template_time_of_day: template.time_of_day,
        time_slots: template.time_slots,
      };
    })
    .filter(Boolean);

  todays.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (b.miss_streak !== a.miss_streak) return b.miss_streak - a.miss_streak;
    if (a.title !== b.title) return a.title.localeCompare(b.title);
    return a.occurrence - b.occurrence;
  });

  return todays;
}

export async function setRecurringCompleted(id, completed) {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const today = todayISO();
    await ensureRecurringForToday(today);

    const { data: inst, error: fetchError } = await supabase
      .from("recurring_instances")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (inst.date !== today) {
      throw new Error("Only today's recurring items can be toggled");
    }

    const next = {
      id: instanceId(inst.template_id, inst.date, inst.occurrence),
      user_id: user.id,
      template_id: inst.template_id,
      date: inst.date,
      occurrence: Number(inst.occurrence) || 1,
      completed: Boolean(completed),
      status: "open",
    };

    const { data, error } = await supabase
      .from("recurring_instances")
      .upsert(next)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeInstance(data);
  }

  return withStoreLock(async () => {
    const today = todayISO();
    const store = await readLocalStore();
    const { changed } = syncStoreForToday(store, today);
    if (changed) await writeLocalStore(store);

    const index = store.instances.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Recurring instance not found: ${id}`);
    }

    const inst = store.instances[index];
    if (inst.date !== today) {
      throw new Error("Only today's recurring items can be toggled");
    }

    store.instances[index] = {
      ...inst,
      id: instanceId(inst.template_id, inst.date, inst.occurrence),
      completed: Boolean(completed),
      status: "open",
    };
    await writeLocalStore(store);
    return store.instances[index];
  });
}

/** Mark today's instance as skipped (not completed; counts as a miss). */
export async function setRecurringSkipped(id) {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const today = todayISO();
    await ensureRecurringForToday(today);

    const { data: inst, error: fetchError } = await supabase
      .from("recurring_instances")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (inst.date !== today) {
      throw new Error("Only today's recurring items can be skipped");
    }

    const next = {
      id: instanceId(inst.template_id, inst.date, inst.occurrence),
      user_id: user.id,
      template_id: inst.template_id,
      date: inst.date,
      occurrence: Number(inst.occurrence) || 1,
      completed: false,
      status: "skipped",
    };

    const { data, error } = await supabase
      .from("recurring_instances")
      .upsert(next)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeInstance(data);
  }

  return withStoreLock(async () => {
    const today = todayISO();
    const store = await readLocalStore();
    const { changed } = syncStoreForToday(store, today);
    if (changed) await writeLocalStore(store);

    const index = store.instances.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Recurring instance not found: ${id}`);
    }

    const inst = store.instances[index];
    if (inst.date !== today) {
      throw new Error("Only today's recurring items can be skipped");
    }

    store.instances[index] = {
      ...inst,
      id: instanceId(inst.template_id, inst.date, inst.occurrence),
      completed: false,
      status: "skipped",
    };
    await writeLocalStore(store);
    return store.instances[index];
  });
}

export async function getHabitPrefs() {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("habit_prefs")
      .select("morning_closed_on")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      morning_closed_on: data?.morning_closed_on ?? null,
    };
  }

  const store = await readLocalStore();
  return {
    morning_closed_on: store.prefs?.morning_closed_on ?? null,
  };
}

export async function setMorningClosedOn(dateISO) {
  const day =
    typeof dateISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)
      ? dateISO
      : todayISO();

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("habit_prefs").upsert(
      { user_id: user.id, morning_closed_on: day },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { morning_closed_on: day };
  }

  return withStoreLock(async () => {
    const store = await readLocalStore();
    store.prefs = { ...(store.prefs || {}), morning_closed_on: day };
    await writeLocalStore(store);
    return { morning_closed_on: day };
  });
}

/**
 * Resolve leftover open morning habits after the cutoff.
 * @param {"complete"|"missed"} resolution
 */
export async function resolveMorningLeftovers(resolution) {
  const today = todayISO();
  const items = await getTodayRecurring(today);
  const openMorning = items.filter(
    (i) =>
      i.time_of_day === "morning" &&
      !i.completed &&
      i.status === "open",
  );

  for (const item of openMorning) {
    if (resolution === "complete") {
      await setRecurringCompleted(item.id, true);
    } else {
      await markRecurringMissed(item.id);
    }
  }

  await setMorningClosedOn(today);
  return {
    morning_closed_on: today,
    resolved: openMorning.map((i) => i.id),
  };
}

async function markRecurringMissed(id) {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const today = todayISO();
    await ensureRecurringForToday(today);

    const { data: inst, error: fetchError } = await supabase
      .from("recurring_instances")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (inst.date !== today) {
      throw new Error("Only today's recurring items can be marked missed");
    }

    const next = {
      id: instanceId(inst.template_id, inst.date, inst.occurrence),
      user_id: user.id,
      template_id: inst.template_id,
      date: inst.date,
      occurrence: Number(inst.occurrence) || 1,
      completed: false,
      status: "incomplete",
    };

    const { data, error } = await supabase
      .from("recurring_instances")
      .upsert(next)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalizeInstance(data);
  }

  return withStoreLock(async () => {
    const today = todayISO();
    const store = await readLocalStore();
    const { changed } = syncStoreForToday(store, today);
    if (changed) await writeLocalStore(store);

    const index = store.instances.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Recurring instance not found: ${id}`);
    }

    const inst = store.instances[index];
    if (inst.date !== today) {
      throw new Error("Only today's recurring items can be marked missed");
    }

    store.instances[index] = {
      ...inst,
      id: instanceId(inst.template_id, inst.date, inst.occurrence),
      completed: false,
      status: "incomplete",
    };
    await writeLocalStore(store);
    return store.instances[index];
  });
}

function slugifyTitle(title) {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return slug || "habit";
}

function nextLocalTemplateId(templates, title) {
  const base = `rec-${slugifyTitle(title)}`;
  if (!templates.some((t) => t.id === base)) return base;
  for (let i = 2; i < 1000; i++) {
    const id = `${base}-${i}`;
    if (!templates.some((t) => t.id === id)) return id;
  }
  return `rec-${crypto.randomUUID().slice(0, 8)}`;
}

const VALID_FREQ = new Set(["DAILY", "WEEKLY"]);

/** Normalize create/promote schedule input into a template body (no id). */
export function normalizeTemplateInput(input, today = todayISO()) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("Title is required");

  const notes =
    input.notes === null || input.notes === undefined
      ? ""
      : String(input.notes);

  const freq = String(input.freq ?? "DAILY").toUpperCase();
  if (!VALID_FREQ.has(freq)) throw new Error("Invalid frequency");

  const interval = Math.max(1, Number(input.interval) || 1);
  const times_per_day = Math.max(1, Math.min(20, Number(input.times_per_day) || 1));

  let byweekday = null;
  let anchor = null;

  if (freq === "WEEKLY") {
    const days = Array.isArray(input.byweekday)
      ? input.byweekday
          .map((d) => String(d).toUpperCase())
          .filter((d) => WEEKDAY_CODES.has(d))
      : [];
    if (days.length === 0) {
      throw new Error("Weekly habits need at least one weekday");
    }
    byweekday = [...new Set(days)];
  } else if (interval > 1) {
    const anchorRaw =
      typeof input.anchor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.anchor)
        ? input.anchor
        : today;
    anchor = anchorRaw;
  }

  const estimate_minutes = normalizeEstimateMinutes(input.estimate_minutes);

  const time_of_day = normalizeTimeOfDay(input.time_of_day);
  const time_slots = normalizeTimeSlots(
    input.time_slots,
    times_per_day,
    time_of_day,
  );

  return {
    title,
    freq,
    interval,
    times_per_day,
    byweekday,
    anchor,
    notes,
    estimate_minutes,
    time_of_day,
    time_slots,
  };
}

export async function createRecurringTemplate(input) {
  const today = todayISO();
  const fields = normalizeTemplateInput(input, today);

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const id = `rec-${crypto.randomUUID().slice(0, 8)}`;
    const row = { id, user_id: user.id, ...fields };
    const { data, error } = await supabase
      .from("recurring_templates")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await ensureRecurringForToday(today);
    return normalizeTemplate(data);
  }

  return withStoreLock(async () => {
    const store = await readLocalStore();
    const id = nextLocalTemplateId(store.templates, fields.title);
    const template = { id, ...fields };
    store.templates.push(template);
    const { changed } = syncStoreForToday(store, today);
    await writeLocalStore(store);
    void changed;
    return normalizeTemplate(template);
  });
}

export async function updateRecurringTemplate(templateId, input) {
  const id = String(templateId ?? "").trim();
  if (!id) throw new Error("Template id is required");
  const today = todayISO();

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("recurring_templates")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    const next = normalizeTemplateInput(
      {
        ...normalizeTemplate(existing),
        ...input,
        anchor:
          input.anchor !== undefined ? input.anchor : existing.anchor,
      },
      today,
    );

    const { data, error } = await supabase
      .from("recurring_templates")
      .update({
        title: next.title,
        freq: next.freq,
        interval: next.interval,
        times_per_day: next.times_per_day,
        byweekday: next.byweekday,
        anchor: next.anchor,
        notes: next.notes,
        estimate_minutes: next.estimate_minutes,
        time_of_day: next.time_of_day,
        time_slots: next.time_slots,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await ensureRecurringForToday(today);
    return normalizeTemplate(data);
  }

  return withStoreLock(async () => {
    const store = await readLocalStore();
    const index = store.templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Recurring template not found: ${id}`);
    }

    const next = normalizeTemplateInput(
      {
        ...store.templates[index],
        ...input,
        anchor:
          input.anchor !== undefined
            ? input.anchor
            : store.templates[index].anchor,
      },
      today,
    );
    store.templates[index] = { id, ...next };
    syncStoreForToday(store, today);
    await writeLocalStore(store);
    return normalizeTemplate(store.templates[index]);
  });
}

export async function deleteRecurringTemplate(templateId) {
  const id = String(templateId ?? "").trim();
  if (!id) throw new Error("Template id is required");

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("recurring_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return { id };
  }

  return withStoreLock(async () => {
    const store = await readLocalStore();
    const before = store.templates.length;
    store.templates = store.templates.filter((t) => t.id !== id);
    if (store.templates.length === before) {
      throw new Error(`Recurring template not found: ${id}`);
    }
    store.instances = store.instances.filter((i) => i.template_id !== id);
    await writeLocalStore(store);
    return { id };
  });
}

/**
 * Create a habit from a one-off todo, then delete the todo.
 * Import deleteTodo lazily to avoid circular deps with db helpers.
 */
export async function promoteTodoToRecurring(todoId, scheduleInput) {
  const { getTodos, deleteTodo } = await import("@/lib/db");
  const todos = await getTodos();
  const todo = todos.find((t) => t.id === todoId);
  if (!todo) throw new Error(`Todo not found: ${todoId}`);

  const template = await createRecurringTemplate({
    ...scheduleInput,
    title: scheduleInput?.title ?? todo.title,
    notes:
      scheduleInput?.notes !== undefined && scheduleInput?.notes !== null
        ? scheduleInput.notes
        : todo.notes,
    estimate_minutes:
      scheduleInput?.estimate_minutes !== undefined
        ? scheduleInput.estimate_minutes
        : todo.estimate_minutes,
  });

  await deleteTodo(todoId);
  return template;
}
