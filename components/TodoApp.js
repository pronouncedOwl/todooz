"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import {
  addTodo,
  convertTodoToProject,
  makeTodoRecurring,
  saveNotes,
  saveTodo,
  toggleTodo,
} from "@/app/actions";
import RecurringForm, {
  EMPTY_RECURRING_DRAFT,
  draftToRecurringFields,
} from "@/components/RecurringForm";
import RecurringSection from "@/components/RecurringSection";
import EstimateChips from "@/components/EstimateChips";
import { formatEstimate, formatRemainingEstimate } from "@/lib/estimates";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const WEEKDAY_BY_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function localWeekdayCode(now = new Date()) {
  return WEEKDAY_BY_INDEX[now.getDay()] || "MO";
}

const EMPTY_DRAFT = {
  title: "",
  priority: "medium",
  due_date: "",
  project: "",
  completed: false,
  notes: "",
  estimate_minutes: null,
};

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

function todoToDraft(todo) {
  return {
    title: todo.title ?? "",
    priority: todo.priority ?? "medium",
    due_date: todo.due_date ?? "",
    project: todo.project ?? "",
    completed: Boolean(todo.completed),
    notes: todo.notes ?? "",
    estimate_minutes: todo.estimate_minutes ?? null,
  };
}

function draftToFields(draft) {
  return {
    title: draft.title,
    priority: draft.priority,
    due_date: draft.due_date || null,
    project: draft.project || null,
    completed: Boolean(draft.completed),
    notes: draft.notes ?? "",
    estimate_minutes: draft.estimate_minutes ?? null,
  };
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-white text-muted hover:border-ink/30",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    high: "bg-[#fdeaea] text-[#b23b3b]",
    medium: "bg-[#fdf3e0] text-[#a06a12]",
    low: "bg-[#eaf1fb] text-[#35618f]",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}

function fieldClassName() {
  return "w-full rounded-lg border border-[#e2e2e2] bg-[#fafaf8] px-3 py-2 text-sm text-ink outline-none focus:border-ink/40";
}

function ProjectPicker({ value, onChange, projects }) {
  const known = projects ?? [];
  const [creatingNew, setCreatingNew] = useState(false);
  const showNewInput =
    creatingNew || (Boolean(value) && !known.includes(value));

  function selectExisting(name) {
    if (name === "__new__") {
      setCreatingNew(true);
      onChange("");
      return;
    }
    setCreatingNew(false);
    onChange(name);
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-[#777]">
          Project
        </span>
        <select
          value={showNewInput ? "__new__" : value || ""}
          onChange={(e) => selectExisting(e.target.value)}
          className={fieldClassName()}
        >
          <option value="">None</option>
          {known.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value="__new__">New project…</option>
        </select>
      </label>
      {showNewInput && (
        <input
          autoFocus
          value={value || ""}
          onChange={(e) => {
            setCreatingNew(true);
            onChange(e.target.value);
          }}
          className={fieldClassName()}
          placeholder="Project name"
        />
      )}
    </div>
  );
}

function NotesEditor({ value, onSave, autoFocus = false }) {
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  function persist(next) {
    if ((next ?? "") === (value ?? "")) return;
    setSaving(true);
    startTransition(async () => {
      await onSave(next ?? "");
      setSaving(false);
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium text-[#777]">Notes</span>
        <span className="text-[11px] text-[#aaa]">
          {saving ? "Saving…" : "Autosaves on blur"}
        </span>
      </div>
      <textarea
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => persist(text)}
        rows={4}
        placeholder="Add notes…"
        className={`${fieldClassName()} min-h-[96px] resize-y leading-relaxed`}
      />
    </div>
  );
}

function TodoForm({
  draft,
  onChange,
  onSave,
  onCancel,
  onMakeRecurring,
  onMakeProject,
  saving,
  submitLabel,
  projects,
}) {
  const showProjectNudge =
    draft.estimate_minutes === 240 && !String(draft.project ?? "").trim();
  return (
    <form
      className="mt-3 space-y-3 border-t border-[#eee] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-[#777]">
          Title
        </span>
        <input
          autoFocus
          required
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          className={fieldClassName()}
          placeholder="What needs doing?"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[#777]">
            Priority
          </span>
          <select
            value={draft.priority}
            onChange={(e) => onChange({ ...draft, priority: e.target.value })}
            className={fieldClassName()}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[#777]">
            Due date
          </span>
          <input
            type="date"
            value={draft.due_date}
            onChange={(e) => onChange({ ...draft, due_date: e.target.value })}
            className={fieldClassName()}
          />
        </label>
      </div>

      <EstimateChips
        value={draft.estimate_minutes}
        onChange={(estimate_minutes) =>
          onChange({ ...draft, estimate_minutes })
        }
      />
      {showProjectNudge && (
        <p className="text-[12px] text-[#a06a12]">
          This looks like a project — consider grouping it under Projects.
        </p>
      )}

      <ProjectPicker
        value={draft.project}
        onChange={(project) => onChange({ ...draft, project })}
        projects={projects}
      />

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-[#777]">
          Notes
        </span>
        <textarea
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          rows={4}
          placeholder="Optional"
          className={`${fieldClassName()} min-h-[96px] resize-y leading-relaxed`}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={draft.completed}
          onChange={(e) => onChange({ ...draft, completed: e.target.checked })}
          className="h-4 w-4 accent-ink"
        />
        Completed
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !draft.title.trim()}
          className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] text-muted"
        >
          Cancel
        </button>
        {onMakeRecurring && (
          <button
            type="button"
            onClick={onMakeRecurring}
            disabled={saving || !draft.title.trim()}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] text-muted hover:border-ink/30 hover:text-ink disabled:opacity-40"
          >
            Make recurring
          </button>
        )}
        {onMakeProject && (
          <button
            type="button"
            onClick={onMakeProject}
            disabled={saving || !draft.title.trim()}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] text-muted hover:border-ink/30 hover:text-ink disabled:opacity-40"
          >
            Make project
          </button>
        )}
      </div>
    </form>
  );
}

function TodoItem({
  todo,
  expanded,
  editing,
  promoting,
  draft,
  recurringDraft,
  saving,
  projects,
  onToggleExpand,
  onToggle,
  onEdit,
  onPromote,
  onDraftChange,
  onRecurringDraftChange,
  onSave,
  onSavePromote,
  onCancel,
  onSaveNotes,
  onMakeProject,
}) {
  const due = formatDue(todo.due_date);
  const hasNotes = Boolean(todo.notes?.trim());
  const busy = editing || promoting;
  const estimateLabel = formatEstimate(todo.estimate_minutes);

  return (
    <li
      className={[
        "rounded-[10px] border bg-white px-3 py-2.5 transition-colors",
        expanded || busy ? "border-ink/25 shadow-sm" : "border-[#eee]",
        !expanded && !busy && todo.completed ? "opacity-45" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={(e) => onToggle(todo.id, e.target.checked)}
          disabled={busy}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-ink disabled:cursor-default"
          aria-label={`Mark "${todo.title}" ${todo.completed ? "incomplete" : "complete"}`}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => onToggleExpand(todo.id)}
              className="min-w-0 flex-1 text-left"
              disabled={busy}
            >
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
                {estimateLabel && (
                  <span className="font-medium text-[#666]">~{estimateLabel}</span>
                )}
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
                {todo.project && <span>{todo.project}</span>}
                {hasNotes && !expanded && !busy && (
                  <span className="text-[#aaa]">Has notes</span>
                )}
              </div>
            </button>
            {!busy && (
              <button
                type="button"
                onClick={() => onEdit(todo)}
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[#777] hover:bg-[#f3f2ef] hover:text-ink"
              >
                Edit
              </button>
            )}
          </div>

          {expanded && !busy && (
            <div className="mt-3 border-t border-[#eee] pt-3">
              <NotesEditor
                key={todo.id}
                value={todo.notes}
                onSave={(notes) => onSaveNotes(todo.id, notes)}
                autoFocus
              />
            </div>
          )}

          {editing && (
            <TodoForm
              draft={draft}
              onChange={onDraftChange}
              onSave={onSave}
              onCancel={onCancel}
              onMakeRecurring={() =>
                onPromote({
                  ...todo,
                  title: draft.title,
                  notes: draft.notes,
                })
              }
              onMakeProject={
                !todo.project && !todo.completed
                  ? () => onMakeProject(todo.id)
                  : undefined
              }
              saving={saving}
              submitLabel="Save"
              projects={projects}
            />
          )}

          {promoting && (
            <div className="mt-3 border-t border-[#eee] pt-3">
              <div className="text-sm font-medium text-ink">
                Make “{todo.title}” recurring
              </div>
              <RecurringForm
                draft={recurringDraft}
                onChange={onRecurringDraftChange}
                onSave={onSavePromote}
                onCancel={onCancel}
                saving={saving}
                submitLabel="Convert"
                titleEditable={false}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function TodoGroup({
  title,
  todos,
  expandedId,
  editingId,
  promotingId,
  draft,
  recurringDraft,
  saving,
  projects,
  onToggleExpand,
  onToggle,
  onEdit,
  onPromote,
  onDraftChange,
  onRecurringDraftChange,
  onSave,
  onSavePromote,
  onCancel,
  onSaveNotes,
  onMakeProject,
}) {
  if (todos.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-wide text-[#999] first:mt-0">
        {title}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            expanded={expandedId === todo.id}
            editing={editingId === todo.id}
            promoting={promotingId === todo.id}
            draft={draft}
            recurringDraft={recurringDraft}
            saving={saving}
            projects={projects}
            onToggleExpand={onToggleExpand}
            onToggle={onToggle}
            onEdit={onEdit}
            onPromote={onPromote}
            onDraftChange={onDraftChange}
            onRecurringDraftChange={onRecurringDraftChange}
            onSave={onSave}
            onSavePromote={onSavePromote}
            onCancel={onCancel}
            onSaveNotes={onSaveNotes}
            onMakeProject={onMakeProject}
          />
        ))}
      </ul>
    </section>
  );
}

export default function TodoApp({
  initialTodos,
  initialRecurring = [],
  initialProjects = [],
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [hideDone, setHideDone] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [promotingId, setPromotingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [recurringDraft, setRecurringDraft] = useState(EMPTY_RECURRING_DRAFT);
  const [saving, setSaving] = useState(false);
  const [optimisticTodos, setOptimistic] = useOptimistic(
    initialTodos,
    (state, action) => {
      if (action.type === "toggle") {
        return state.map((t) =>
          t.id === action.id ? { ...t, completed: action.completed } : t,
        );
      }
      if (action.type === "update") {
        return state.map((t) =>
          t.id === action.todo.id ? { ...t, ...action.todo } : t,
        );
      }
      if (action.type === "add") {
        return [...state, action.todo];
      }
      if (action.type === "remove") {
        return state.filter((t) => t.id !== action.id);
      }
      return state;
    },
  );
  const [optimisticProjects, setOptimisticProjects] = useOptimistic(
    initialProjects,
    (state, action) => {
      if (action.type === "add" && action.name && !state.includes(action.name)) {
        return [...state, action.name].sort((a, b) => a.localeCompare(b));
      }
      return state;
    },
  );
  const [, startTransition] = useTransition();

  const projectNames = useMemo(() => {
    const fromTodos = optimisticTodos.map((t) => t.project).filter(Boolean);
    return [...new Set([...optimisticProjects, ...fromTodos])].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [optimisticTodos, optimisticProjects]);

  const doneCount = optimisticTodos.filter((t) => t.completed).length;
  const remaining = formatRemainingEstimate(optimisticTodos);

  const { withDue, noDue, done } = useMemo(() => {
    const filtered = optimisticTodos.filter((task) => {
      if (filter !== "all" && task.priority !== filter) return false;
      return true;
    });

    const active = filtered.filter((t) => !t.completed);
    const completed = hideDone
      ? []
      : filtered
          .filter((t) => t.completed)
          .sort((a, b) => {
            if (a.due_date && b.due_date && a.due_date !== b.due_date) {
              return a.due_date < b.due_date ? -1 : 1;
            }
            if (a.due_date && !b.due_date) return -1;
            if (!a.due_date && b.due_date) return 1;
            return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          });

    const due = active
      .filter((t) => t.due_date)
      .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

    const undated = active
      .filter((t) => !t.due_date)
      .sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      );

    return { withDue: due, noDue: undated, done: completed };
  }, [optimisticTodos, filter, hideDone]);

  function closeEditor() {
    setEditingId(null);
    setPromotingId(null);
    setAdding(false);
    setDraft(EMPTY_DRAFT);
    setRecurringDraft(EMPTY_RECURRING_DRAFT);
    setSaving(false);
  }

  function handleToggleExpand(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleEdit(todo) {
    setAdding(false);
    setPromotingId(null);
    setExpandedId(null);
    setEditingId(todo.id);
    setDraft(todoToDraft(todo));
  }

  function handlePromote(todo) {
    setAdding(false);
    setEditingId(null);
    setExpandedId(null);
    setPromotingId(todo.id);
    setRecurringDraft({
      ...EMPTY_RECURRING_DRAFT,
      title: todo.title ?? "",
      notes: typeof todo.notes === "string" ? todo.notes : "",
      byweekday: [localWeekdayCode()],
      estimate_minutes: todo.estimate_minutes ?? null,
    });
  }

  function handleAdd() {
    setEditingId(null);
    setPromotingId(null);
    setExpandedId(null);
    setAdding(true);
    setDraft(EMPTY_DRAFT);
  }

  function handleToggle(id, completed) {
    startTransition(async () => {
      setOptimistic({ type: "toggle", id, completed });
      await toggleTodo(id, completed);
    });
  }

  function handleSaveNotes(id, notes) {
    startTransition(async () => {
      setOptimistic({ type: "update", todo: { id, notes } });
      await saveNotes(id, notes);
    });
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const fields = draftToFields(draft);
    setSaving(true);
    startTransition(async () => {
      if (fields.project) {
        setOptimisticProjects({ type: "add", name: fields.project });
      }
      setOptimistic({ type: "update", todo: { id: editingId, ...fields } });
      await saveTodo(editingId, fields);
      closeEditor();
    });
  }

  function handleSavePromote() {
    if (!promotingId) return;
    const fields = draftToRecurringFields(recurringDraft);
    setSaving(true);
    startTransition(async () => {
      try {
        setOptimistic({ type: "remove", id: promotingId });
        await makeTodoRecurring(promotingId, fields);
        closeEditor();
        router.refresh();
      } catch (err) {
        setSaving(false);
        window.alert(err?.message || "Could not convert todo");
        router.refresh();
      }
    });
  }

  function handleSaveAdd() {
    const fields = draftToFields(draft);
    setSaving(true);
    startTransition(async () => {
      if (fields.project) {
        setOptimisticProjects({ type: "add", name: fields.project });
      }
      const created = await addTodo(fields);
      setOptimistic({ type: "add", todo: created });
      closeEditor();
    });
  }

  function handleMakeProject(id) {
    startTransition(async () => {
      const updated = await convertTodoToProject(id);
      setOptimistic({ type: "update", todo: updated });
      if (updated.project) {
        setOptimisticProjects({ type: "add", name: updated.project });
      }
      closeEditor();
    });
  }

  const groupProps = {
    expandedId,
    editingId,
    promotingId,
    draft,
    recurringDraft,
    saving,
    projects: projectNames,
    onToggleExpand: handleToggleExpand,
    onToggle: handleToggle,
    onEdit: handleEdit,
    onPromote: handlePromote,
    onDraftChange: setDraft,
    onRecurringDraftChange: setRecurringDraft,
    onSave: handleSaveEdit,
    onSavePromote: handleSavePromote,
    onCancel: closeEditor,
    onSaveNotes: handleSaveNotes,
    onMakeProject: handleMakeProject,
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <RecurringSection initialItems={initialRecurring} />

      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Todos</h1>
          <p className="mt-1 text-[13px] text-[#777]">
            All tasks. Group related work under Projects.
          </p>
        </div>
        {!adding && (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/export"
              className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-muted hover:border-ink/30 hover:text-ink"
            >
              Export
            </Link>
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
            >
              Add
            </button>
          </div>
        )}
      </header>

      {adding && (
        <div className="mb-4 rounded-[10px] border border-ink/25 bg-white px-3 py-3 shadow-sm">
          <div className="text-sm font-medium text-ink">New todo</div>
          <TodoForm
            draft={draft}
            onChange={setDraft}
            onSave={handleSaveAdd}
            onCancel={closeEditor}
            saving={saving}
            submitLabel="Add"
            projects={projectNames}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", "high", "medium", "low"].map((key) => (
          <FilterButton
            key={key}
            active={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === "all" ? "All" : key[0].toUpperCase() + key.slice(1)}
          </FilterButton>
        ))}
        <FilterButton
          active={hideDone}
          onClick={() => setHideDone((v) => !v)}
        >
          {hideDone ? "Show completed" : "Hide completed"}
        </FilterButton>
        <span className="ml-auto text-[13px] text-[#777]">
          {doneCount} / {optimisticTodos.length} done
          {remaining ? ` · ${remaining}` : ""}
        </span>
      </div>

      <TodoGroup title="Due dates" todos={withDue} {...groupProps} />
      <TodoGroup title="No due date" todos={noDue} {...groupProps} />

      {done.length > 0 && (
        <div className="mt-4 opacity-70">
          <TodoGroup title="Done" todos={done} {...groupProps} />
        </div>
      )}

      {withDue.length === 0 && noDue.length === 0 && done.length === 0 && !adding && (
        <p className="rounded-[10px] border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-[#888]">
          Nothing matches this filter.
        </p>
      )}
    </div>
  );
}
