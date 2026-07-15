"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { addTodo, saveNotes, saveTodo, toggleTodo } from "@/app/actions";
import RecurringSection from "@/components/RecurringSection";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const EMPTY_DRAFT = {
  title: "",
  priority: "medium",
  due_date: "",
  project: "",
  completed: false,
  notes: "",
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

function NotesEditor({ value, onSave, autoFocus = false }) {
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

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

function TodoForm({ draft, onChange, onSave, onCancel, saving, submitLabel }) {
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

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-[#777]">
          Project
        </span>
        <input
          value={draft.project}
          onChange={(e) => onChange({ ...draft, project: e.target.value })}
          className={fieldClassName()}
          placeholder="Optional"
        />
      </label>

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

      <div className="flex gap-2 pt-1">
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
      </div>
    </form>
  );
}

function TodoItem({
  todo,
  expanded,
  editing,
  draft,
  saving,
  onToggleExpand,
  onToggle,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
  onSaveNotes,
}) {
  const due = formatDue(todo.due_date);
  const hasNotes = Boolean(todo.notes?.trim());

  return (
    <li
      className={[
        "rounded-[10px] border bg-white px-3 py-2.5 transition-colors",
        expanded || editing ? "border-ink/25 shadow-sm" : "border-[#eee]",
        !expanded && !editing && todo.completed ? "opacity-45" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={(e) => onToggle(todo.id, e.target.checked)}
          disabled={editing}
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
              disabled={editing}
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
                {hasNotes && !expanded && !editing && (
                  <span className="text-[#aaa]">Has notes</span>
                )}
              </div>
            </button>
            {!editing && (
              <button
                type="button"
                onClick={() => onEdit(todo)}
                className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[#777] hover:bg-[#f3f2ef] hover:text-ink"
              >
                Edit
              </button>
            )}
          </div>

          {expanded && !editing && (
            <div className="mt-3 border-t border-[#eee] pt-3">
              <NotesEditor
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
              saving={saving}
              submitLabel="Save"
            />
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
  draft,
  saving,
  onToggleExpand,
  onToggle,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
  onSaveNotes,
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
            draft={draft}
            saving={saving}
            onToggleExpand={onToggleExpand}
            onToggle={onToggle}
            onEdit={onEdit}
            onDraftChange={onDraftChange}
            onSave={onSave}
            onCancel={onCancel}
            onSaveNotes={onSaveNotes}
          />
        ))}
      </ul>
    </section>
  );
}

export default function TodoApp({ initialTodos, initialRecurring = [] }) {
  const [filter, setFilter] = useState("all");
  const [hideDone, setHideDone] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
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
      return state;
    },
  );
  const [, startTransition] = useTransition();

  const doneCount = optimisticTodos.filter((t) => t.completed).length;

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
    setAdding(false);
    setDraft(EMPTY_DRAFT);
    setSaving(false);
  }

  function handleToggleExpand(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleEdit(todo) {
    setAdding(false);
    setExpandedId(null);
    setEditingId(todo.id);
    setDraft(todoToDraft(todo));
  }

  function handleAdd() {
    setEditingId(null);
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
      setOptimistic({ type: "update", todo: { id: editingId, ...fields } });
      await saveTodo(editingId, fields);
      closeEditor();
    });
  }

  function handleSaveAdd() {
    const fields = draftToFields(draft);
    setSaving(true);
    startTransition(async () => {
      const created = await addTodo(fields);
      setOptimistic({ type: "add", todo: created });
      closeEditor();
    });
  }

  const groupProps = {
    expandedId,
    editingId,
    draft,
    saving,
    onToggleExpand: handleToggleExpand,
    onToggle: handleToggle,
    onEdit: handleEdit,
    onDraftChange: setDraft,
    onSave: handleSaveEdit,
    onCancel: closeEditor,
    onSaveNotes: handleSaveNotes,
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
          <button
            type="button"
            onClick={handleAdd}
            className="shrink-0 rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
          >
            Add
          </button>
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
