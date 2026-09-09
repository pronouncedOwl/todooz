import { promises as fs } from "fs";
import path from "path";
import { requireUser } from "@/lib/auth";
import { normalizeEstimateMinutes } from "@/lib/estimates";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const DATA_PATH = path.join(process.cwd(), "data", "todos.json");
const PROJECTS_PATH = path.join(process.cwd(), "data", "projects.json");
const PRIORITIES = new Set(["high", "medium", "low"]);
const TODO_SELECT =
  "id, title, priority, due_date, project, completed, completed_at, notes, estimate_minutes";

function supabaseEnabled() {
  return isSupabaseConfigured();
}

async function readLocal() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw).map(normalizeTodo);
}

async function writeLocal(todos) {
  await fs.writeFile(DATA_PATH, JSON.stringify(todos, null, 2) + "\n", "utf8");
}

function normalizeTodo(todo) {
  let estimate_minutes = null;
  if (todo.estimate_minutes != null && todo.estimate_minutes !== "") {
    try {
      estimate_minutes = normalizeEstimateMinutes(todo.estimate_minutes);
    } catch {
      estimate_minutes = null;
    }
  }
  return {
    id: todo.id,
    title: todo.title,
    priority: todo.priority,
    due_date: todo.due_date ?? null,
    project: todo.project ?? null,
    completed: Boolean(todo.completed),
    completed_at: todo.completed_at ?? null,
    notes: typeof todo.notes === "string" ? todo.notes : "",
    estimate_minutes,
  };
}

function normalizeFields(input) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("Title is required");

  const priority = String(input.priority ?? "medium");
  if (!PRIORITIES.has(priority)) throw new Error("Invalid priority");

  const dueRaw = input.due_date;
  const due_date =
    dueRaw === null || dueRaw === undefined || String(dueRaw).trim() === ""
      ? null
      : String(dueRaw).trim();

  if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
    throw new Error("due_date must be YYYY-MM-DD");
  }

  const projectRaw = input.project;
  const project =
    projectRaw === null ||
    projectRaw === undefined ||
    String(projectRaw).trim() === ""
      ? null
      : String(projectRaw).trim();

  const notes =
    input.notes === null || input.notes === undefined
      ? ""
      : String(input.notes);

  const estimate_minutes = normalizeEstimateMinutes(input.estimate_minutes);

  return {
    title,
    priority,
    due_date,
    project,
    completed: Boolean(input.completed),
    notes,
    estimate_minutes,
  };
}

function mergePatch(existing, patch) {
  const next = normalizeFields({
    title: patch.title ?? existing.title,
    priority: patch.priority ?? existing.priority,
    due_date: patch.due_date !== undefined ? patch.due_date : existing.due_date,
    project: patch.project !== undefined ? patch.project : existing.project,
    completed:
      patch.completed !== undefined ? patch.completed : existing.completed,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    estimate_minutes:
      patch.estimate_minutes !== undefined
        ? patch.estimate_minutes
        : existing.estimate_minutes,
  });

  let completed_at = existing.completed_at ?? null;
  if (patch.completed !== undefined) {
    if (next.completed && !existing.completed) {
      completed_at = new Date().toISOString();
    } else if (!next.completed) {
      completed_at = null;
    }
  }

  return { ...next, completed_at };
}

function nextLocalId(todos) {
  let max = 0;
  for (const todo of todos) {
    const match = /^task-(\d+)$/.exec(todo.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `task-${String(max + 1).padStart(3, "0")}`;
}

export async function getTodos() {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("todos")
      .select(TODO_SELECT)
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(normalizeTodo);
  }

  return readLocal();
}

export async function setTodoCompleted(id, completed) {
  return updateTodo(id, { completed: Boolean(completed) });
}

export async function updateTodo(id, patch) {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: existing, error: fetchError } = await supabase
      .from("todos")
      .select(TODO_SELECT)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const next = mergePatch(normalizeTodo(existing), patch);
    const { data, error } = await supabase
      .from("todos")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(TODO_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return normalizeTodo(data);
  }

  const todos = await readLocal();
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) throw new Error(`Todo not found: ${id}`);

  const next = mergePatch(todos[index], patch);
  todos[index] = { ...todos[index], ...next };
  await writeLocal(todos);
  return todos[index];
}

export async function createTodo(input) {
  const fields = normalizeFields({
    ...input,
    notes: input.notes ?? "",
  });
  const completed_at = fields.completed ? new Date().toISOString() : null;

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const id = `task-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await supabase
      .from("todos")
      .insert({ id, user_id: user.id, ...fields, completed_at })
      .select(TODO_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return normalizeTodo(data);
  }

  const todos = await readLocal();
  const todo = { id: nextLocalId(todos), ...fields, completed_at };
  todos.push(todo);
  await writeLocal(todos);
  return todo;
}

export async function updateTodoNotes(todoId, notes) {
  return updateTodo(todoId, { notes: String(notes ?? "") });
}

async function readLocalProjectNames() {
  try {
    const raw = await fs.readFile(PROJECTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((p) => String(p).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

async function writeLocalProjectNames(names) {
  const unique = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  unique.sort((a, b) => a.localeCompare(b));
  await fs.writeFile(
    PROJECTS_PATH,
    JSON.stringify(unique, null, 2) + "\n",
    "utf8",
  );
  return unique;
}

async function readRemoteProjectNames(userId, supabase) {
  const { data, error } = await supabase
    .from("projects")
    .select("name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.name).filter(Boolean);
}

/** Project names from the projects list + any names already on todos. */
export async function getProjects() {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const [named, todos] = await Promise.all([
      readRemoteProjectNames(user.id, supabase),
      getTodos(),
    ]);
    const fromTodos = todos.map((t) => t.project).filter(Boolean);
    return [...new Set([...named, ...fromTodos])].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  const [named, todos] = await Promise.all([
    readLocalProjectNames(),
    getTodos(),
  ]);
  const fromTodos = todos.map((t) => t.project).filter(Boolean);
  return [...new Set([...named, ...fromTodos])].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function createProject(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("Project name is required");

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.from("projects").upsert(
      { user_id: user.id, name: trimmed },
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return trimmed;
  }

  const names = await readLocalProjectNames();
  if (!names.includes(trimmed)) {
    names.push(trimmed);
    await writeLocalProjectNames(names);
  }
  return trimmed;
}

/**
 * Remove a project name from the registry and unassign all its todos.
 * Does not delete the todos themselves.
 */
export async function deleteProject(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("Project name is required");

  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();

    const { error: unassignError } = await supabase
      .from("todos")
      .update({ project: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("project", trimmed);
    if (unassignError) throw new Error(unassignError.message);

    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("user_id", user.id)
      .eq("name", trimmed);
    if (deleteError) throw new Error(deleteError.message);

    return { name: trimmed };
  }

  const todos = await readLocal();
  let changed = false;
  for (const todo of todos) {
    if (todo.project === trimmed) {
      todo.project = null;
      changed = true;
    }
  }
  if (changed) await writeLocal(todos);

  const names = await readLocalProjectNames();
  await writeLocalProjectNames(names.filter((n) => n !== trimmed));
  return { name: trimmed };
}

/**
 * Turn a standalone todo into a project named after its title,
 * assigning the todo as the first subtask.
 */
export async function makeTodoIntoProject(todoId) {
  const todos = await getTodos();
  const todo = todos.find((t) => t.id === todoId);
  if (!todo) throw new Error(`Todo not found: ${todoId}`);
  if (todo.project) {
    throw new Error("Todo already belongs to a project");
  }

  const name = String(todo.title ?? "").trim();
  if (!name) throw new Error("Todo title is required to make a project");

  await createProject(name);
  return updateTodo(todoId, { project: name });
}

export async function deleteTodo(id) {
  if (supabaseEnabled()) {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return { id };
  }

  const todos = await readLocal();
  const next = todos.filter((t) => t.id !== id);
  if (next.length === todos.length) throw new Error(`Todo not found: ${id}`);
  await writeLocal(next);
  return { id };
}
