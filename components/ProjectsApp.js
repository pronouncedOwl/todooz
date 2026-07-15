"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  addProject,
  addTodo,
  removeTodo,
  toggleTodo,
} from "@/app/actions";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDue(due) {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  const label = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { label, overdue: due < todayISO() };
}

function PriorityBadge({ priority }) {
  const styles = {
    high: "bg-[#fdeaea] text-[#b23b3b]",
    medium: "bg-[#fdf3e0] text-[#a06a12]",
    low: "bg-[#eaf1fb] text-[#35618f]",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[priority] || styles.medium}`}
    >
      {priority}
    </span>
  );
}

function fieldClassName() {
  return "w-full rounded-lg border border-[#e2e2e2] bg-[#fafaf8] px-3 py-2 text-sm text-ink outline-none focus:border-ink/40";
}

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
}

function ProjectTask({ todo, onToggle, onRemove }) {
  const due = formatDue(todo.due_date);

  return (
    <li
      className={[
        "flex items-start gap-2 rounded-lg border border-[#eee] bg-[#fafaf8] px-2.5 py-2",
        todo.completed ? "opacity-45" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => onToggle(todo.id, e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ink"
        aria-label={`Mark "${todo.title}" ${todo.completed ? "incomplete" : "complete"}`}
      />
      <div className="min-w-0 flex-1">
        <div
          className={[
            "text-sm leading-snug text-ink",
            todo.completed ? "line-through" : "",
          ].join(" ")}
        >
          {todo.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#888]">
          <PriorityBadge priority={todo.priority} />
          {due && (
            <span
              className={[
                "font-semibold",
                due.overdue && !todo.completed ? "text-[#b23b3b]" : "",
              ].join(" ")}
            >
              {due.overdue && !todo.completed ? "Overdue · " : "Due "}
              {due.label}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(todo.id)}
        className="shrink-0 rounded-full px-2 py-1 text-[12px] text-[#999] hover:bg-white hover:text-[#b23b3b]"
        aria-label={`Remove ${todo.title}`}
      >
        Remove
      </button>
    </li>
  );
}

function AddSubtaskForm({ projectName, onAdd, onCancel }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      project: projectName,
      completed: false,
      notes: "",
    });
    setTitle("");
    setPriority("medium");
    setDueDate("");
    setSaving(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border border-dashed border-[#ddd] bg-white px-3 py-3"
    >
      <input
        autoFocus
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New subtask…"
        className={fieldClassName()}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={fieldClassName()}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={fieldClassName()}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {saving ? "Adding…" : "Add subtask"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProjectCard({
  name,
  todos,
  expanded,
  adding,
  onToggleExpand,
  onStartAdd,
  onCancelAdd,
  onAddSubtask,
  onToggle,
  onRemove,
}) {
  const done = todos.filter((t) => t.completed).length;
  const sorted = sortTodos(todos);

  return (
    <section
      className={[
        "rounded-[12px] border bg-white transition-colors",
        expanded ? "border-ink/25 shadow-sm" : "border-[#eee]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onToggleExpand(name)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span
          className={[
            "text-[#999] transition-transform",
            expanded ? "rotate-90" : "",
          ].join(" ")}
          aria-hidden
        >
          ▸
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">{name}</div>
          <div className="mt-0.5 text-[12px] text-[#888]">
            {done} / {todos.length} done
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-[#eee] px-3.5 py-3">
          {sorted.length === 0 && !adding && (
            <p className="text-sm text-[#999]">No subtasks yet.</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {sorted.map((todo) => (
              <ProjectTask
                key={todo.id}
                todo={todo}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            ))}
          </ul>

          {adding ? (
            <AddSubtaskForm
              projectName={name}
              onAdd={onAddSubtask}
              onCancel={onCancelAdd}
            />
          ) : (
            <button
              type="button"
              onClick={() => onStartAdd(name)}
              className="rounded-full border border-line bg-[#fafaf8] px-3.5 py-1.5 text-[13px] text-muted hover:border-ink/30 hover:text-ink"
            >
              + Add subtask
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function ProjectsApp({ initialTodos, initialProjects }) {
  const [expanded, setExpanded] = useState(null);
  const [addingFor, setAddingFor] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [optimisticTodos, setOptimisticTodos] = useOptimistic(
    initialTodos,
    (state, action) => {
      if (action.type === "toggle") {
        return state.map((t) =>
          t.id === action.id ? { ...t, completed: action.completed } : t,
        );
      }
      if (action.type === "add") return [...state, action.todo];
      if (action.type === "remove") {
        return state.filter((t) => t.id !== action.id);
      }
      return state;
    },
  );
  const [optimisticProjects, setOptimisticProjects] = useOptimistic(
    initialProjects,
    (state, action) => {
      if (action.type === "add" && !state.includes(action.name)) {
        return [...state, action.name].sort((a, b) => a.localeCompare(b));
      }
      return state;
    },
  );
  const [, startTransition] = useTransition();

  const { activeProjects, doneProjects } = useMemo(() => {
    const fromTodos = optimisticTodos.map((t) => t.project).filter(Boolean);
    const names = [...new Set([...optimisticProjects, ...fromTodos])].sort(
      (a, b) => a.localeCompare(b),
    );

    const all = names.map((name) => ({
      name,
      todos: optimisticTodos.filter((t) => t.project === name),
    }));

    const isDone = (project) =>
      project.todos.length > 0 && project.todos.every((t) => t.completed);

    return {
      activeProjects: all.filter((p) => !isDone(p)),
      doneProjects: all.filter(isDone),
    };
  }, [optimisticTodos, optimisticProjects]);

  function handleToggleExpand(name) {
    setExpanded((current) => (current === name ? null : name));
    if (addingFor && addingFor !== name) setAddingFor(null);
  }

  function handleToggle(id, completed) {
    startTransition(async () => {
      setOptimisticTodos({ type: "toggle", id, completed });
      await toggleTodo(id, completed);
    });
  }

  function handleRemove(id) {
    startTransition(async () => {
      setOptimisticTodos({ type: "remove", id });
      await removeTodo(id);
    });
  }

  async function handleAddSubtask(fields) {
    await new Promise((resolve) => {
      startTransition(async () => {
        const created = await addTodo(fields);
        setOptimisticTodos({ type: "add", todo: created });
        setAddingFor(null);
        resolve();
      });
    });
  }

  function handleCreateProject(e) {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;

    startTransition(async () => {
      setOptimisticProjects({ type: "add", name });
      await addProject(name);
      setNewProjectName("");
      setShowNewProject(false);
      setExpanded(name);
      setAddingFor(name);
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Projects</h1>
          <p className="mt-1 text-[13px] text-[#777]">
            Expand a project to see and manage its subtasks.
          </p>
        </div>
        {!showNewProject && (
          <button
            type="button"
            onClick={() => setShowNewProject(true)}
            className="shrink-0 rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
          >
            Add project
          </button>
        )}
      </header>

      {showNewProject && (
        <form
          onSubmit={handleCreateProject}
          className="mb-4 space-y-2 rounded-[12px] border border-ink/25 bg-white px-3.5 py-3 shadow-sm"
        >
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[#777]">
              Project name
            </span>
            <input
              autoFocus
              required
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className={fieldClassName()}
              placeholder="e.g. Kitchen remodel"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newProjectName.trim()}
              className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewProject(false);
                setNewProjectName("");
              }}
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2">
        {activeProjects.map((project) => (
          <ProjectCard
            key={project.name}
            name={project.name}
            todos={project.todos}
            expanded={expanded === project.name}
            adding={addingFor === project.name}
            onToggleExpand={handleToggleExpand}
            onStartAdd={setAddingFor}
            onCancelAdd={() => setAddingFor(null)}
            onAddSubtask={handleAddSubtask}
            onToggle={handleToggle}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {doneProjects.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#999]">
            Done
          </h2>
          <div className="flex flex-col gap-2 opacity-70">
            {doneProjects.map((project) => (
              <ProjectCard
                key={project.name}
                name={project.name}
                todos={project.todos}
                expanded={expanded === project.name}
                adding={addingFor === project.name}
                onToggleExpand={handleToggleExpand}
                onStartAdd={setAddingFor}
                onCancelAdd={() => setAddingFor(null)}
                onAddSubtask={handleAddSubtask}
                onToggle={handleToggle}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </section>
      )}

      {activeProjects.length === 0 && doneProjects.length === 0 && (
        <p className="rounded-[12px] border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-[#888]">
          No projects yet. Create one to start adding subtasks.
        </p>
      )}
    </div>
  );
}
