import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const DATA_PATH = path.join(process.cwd(), "data", "recurring.json");

const WEEKDAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

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

export function todayISO(now = new Date()) {
  return toISODate(now);
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
  };
}

async function writeLocalStore(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
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
  return {
    id: row.id,
    title: row.title,
    freq: row.freq,
    interval: Number(row.interval) || 1,
    times_per_day: Number(row.times_per_day) || 1,
    byweekday: Array.isArray(row.byweekday) ? row.byweekday : null,
    anchor: row.anchor ?? null,
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

function normalizeInstance(row) {
  return {
    id: row.id,
    template_id: row.template_id,
    date: row.date,
    occurrence: Number(row.occurrence) || 1,
    completed: Boolean(row.completed),
    status: row.status || "open",
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
        notes: template.notes || "",
        occurrence: inst.occurrence,
        times_per_day: times,
        date: inst.date,
        completed: Boolean(inst.completed),
        status: inst.status,
        miss_streak: streak,
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
