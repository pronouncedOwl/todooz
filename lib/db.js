import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const DATA_PATH = path.join(process.cwd(), "data", "todos.json");
const PROJECTS_PATH = path.join(process.cwd(), "data", "projects.json");
const PRIORITIES = new Set(["high", "medium", "low"]);
const TODO_SELECT =
  "id, title, priority, due_date, project, completed, notes";

function useSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function readLocal() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw).map(normalizeTodo);
}

async function writeLocal(todos) {
  await fs.writeFile(DATA_PATH, JSON.stringify(todos, null, 2) + "\n", "utf8");
}

function normalizeTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    priority: todo.priority,
    due_date: todo.due_date ?? null,
    project: todo.project ?? null,
    completed: Boolean(todo.completed),
    notes: typeof todo.notes === "string" ? todo.notes : "",
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

  return {
    title,
    priority,
    due_date,
    project,
    completed: Boolean(input.completed),
    notes,
  };
}

function mergePatch(existing, patch) {
  return normalizeFields({
    title: patch.title ?? existing.title,
    priority: patch.priority ?? existing.priority,
    due_date: patch.due_date !== undefined ? patch.due_date : existing.due_date,
    project: patch.project !== undefined ? patch.project : existing.project,
    completed:
      patch.completed !== undefined ? patch.completed : existing.completed,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
  });
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
  if (useSupabase()) {
    const { data, error } = await getSupabase()
      .from("todos")
      .select(TODO_SELECT)
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
  if (useSupabase()) {
    const { data: existing, error: fetchError } = await getSupabase()
      .from("todos")
      .select(TODO_SELECT)
      .eq("id", id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const next = mergePatch(normalizeTodo(existing), patch);
    const { data, error } = await getSupabase()
      .from("todos")
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq("id", id)
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

  if (useSupabase()) {
    const id = `task-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await getSupabase()
      .from("todos")
      .insert({ id, ...fields })
      .select(TODO_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return normalizeTodo(data);
  }

  const todos = await readLocal();
  const todo = { id: nextLocalId(todos), ...fields };
  todos.push(todo);
  await writeLocal(todos);
  return todo;
}

export async function updateTodoNotes(todoId, notes) {
  return updateTodo(todoId, { notes: String(notes ?? "") });
}

async function readProjectNames() {
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

async function writeProjectNames(names) {
  const unique = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  unique.sort((a, b) => a.localeCompare(b));
  await fs.writeFile(
    PROJECTS_PATH,
    JSON.stringify(unique, null, 2) + "\n",
    "utf8",
  );
  return unique;
}

/** Project names from the projects list + any names already on todos. */
export async function getProjects() {
  const [named, todos] = await Promise.all([readProjectNames(), getTodos()]);
  const fromTodos = todos.map((t) => t.project).filter(Boolean);
  return [...new Set([...named, ...fromTodos])].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function createProject(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("Project name is required");

  const names = await readProjectNames();
  if (!names.includes(trimmed)) {
    names.push(trimmed);
    await writeProjectNames(names);
  }
  return trimmed;
}

export async function deleteTodo(id) {
  if (useSupabase()) {
    const { error } = await getSupabase().from("todos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  }

  const todos = await readLocal();
  const next = todos.filter((t) => t.id !== id);
  if (next.length === todos.length) throw new Error(`Todo not found: ${id}`);
  await writeLocal(next);
  return { id };
}
