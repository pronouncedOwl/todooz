import { todayISO } from "@/lib/dates";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function sortActiveTodos(todos) {
  const withDue = todos
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const noDue = todos
    .filter((t) => !t.due_date)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return [...withDue, ...noDue];
}

function mapTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    priority: todo.priority,
    due_date: todo.due_date ?? null,
    project: todo.project ?? null,
    notes: typeof todo.notes === "string" ? todo.notes : "",
    estimate_minutes:
      todo.estimate_minutes == null ? null : Number(todo.estimate_minutes),
  };
}

function mapRecurring(item) {
  return {
    id: item.id,
    template_id: item.template_id,
    title: item.title,
    notes: typeof item.notes === "string" ? item.notes : "",
    occurrence: item.occurrence,
    times_per_day: item.times_per_day,
    date: item.date,
    miss_streak: Number(item.miss_streak) || 0,
    estimate_minutes:
      item.estimate_minutes == null ? null : Number(item.estimate_minutes),
  };
}

/**
 * Build a clipboard/agent-friendly dump of incomplete todos and
 * today's incomplete recurring / self-care items.
 */
export function buildActiveExportPayload(todos, recurring, now = new Date()) {
  const activeTodos = sortActiveTodos(
    (todos ?? []).filter((t) => !t.completed),
  ).map(mapTodo);

  const openRecurring = (recurring ?? [])
    .filter((item) => !item.completed)
    .map(mapRecurring);

  const date = todayISO(now);

  return {
    exported_at: date,
    source: "toodooz",
    tasks: {
      active_count: activeTodos.length,
      items: activeTodos,
    },
    recurring: {
      date,
      incomplete_count: openRecurring.length,
      items: openRecurring,
    },
  };
}

export function formatActiveExportJson(todos, recurring, now = new Date()) {
  return JSON.stringify(buildActiveExportPayload(todos, recurring, now), null, 2);
}
