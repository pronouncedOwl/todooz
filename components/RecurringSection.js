"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRecurring, stopRecurring, toggleRecurring } from "@/app/actions";
import RecurringForm, {
  EMPTY_RECURRING_DRAFT,
  draftToRecurringFields,
} from "@/components/RecurringForm";

const WEEKDAY_BY_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function localWeekdayCode(now = new Date()) {
  return WEEKDAY_BY_INDEX[now.getDay()] || "MO";
}

function RecurringItem({ item, onToggle, onStop, stopping }) {
  return (
    <li
      className={[
        "flex items-start gap-2.5 rounded-[10px] border border-[#eee] bg-white px-3 py-2.5",
        item.completed ? "opacity-45" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={item.completed}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-ink"
        aria-label={`Mark "${item.title}" ${item.completed ? "incomplete" : "complete"}`}
      />
      <div className="min-w-0 flex-1">
        <div
          className={[
            "text-sm leading-snug text-ink",
            item.completed ? "line-through" : "",
          ].join(" ")}
        >
          {item.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#888]">
          {item.miss_streak > 0 && !item.completed && (
            <span className="rounded-full bg-[#fdeaea] px-2 py-0.5 text-[11px] font-semibold text-[#b23b3b]">
              Missed {item.miss_streak}×
            </span>
          )}
          {item.notes && <span>{item.notes}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onStop(item.template_id, item.title)}
        disabled={stopping}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[#777] hover:bg-[#f3f2ef] hover:text-ink disabled:opacity-40"
      >
        Stop
      </button>
    </li>
  );
}

export default function RecurringSection({ initialItems }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_RECURRING_DRAFT);
  const [saving, setSaving] = useState(false);
  const [stoppingId, setStoppingId] = useState(null);
  const [items, setOptimistic] = useOptimistic(
    initialItems,
    (state, action) => {
      if (action.type === "toggle") {
        return state
          .map((item) =>
            item.id === action.id
              ? { ...item, completed: action.completed }
              : item,
          )
          .sort((a, b) => {
            if (b.miss_streak !== a.miss_streak) return b.miss_streak - a.miss_streak;
            if (a.title !== b.title) return a.title.localeCompare(b.title);
            return a.occurrence - b.occurrence;
          });
      }
      if (action.type === "removeTemplate") {
        return state.filter((item) => item.template_id !== action.templateId);
      }
      return state;
    },
  );
  const [, startTransition] = useTransition();

  const openItems = items.filter((i) => !i.completed);
  const doneCount = items.length - openItems.length;

  function closeAdd() {
    setAdding(false);
    setDraft(EMPTY_RECURRING_DRAFT);
    setSaving(false);
  }

  function handleAdd() {
    setDraft({
      ...EMPTY_RECURRING_DRAFT,
      byweekday: [localWeekdayCode()],
    });
    setAdding(true);
  }

  function handleToggle(id, completed) {
    startTransition(async () => {
      setOptimistic({ type: "toggle", id, completed });
      await toggleRecurring(id, completed);
    });
  }

  function handleStop(templateId, title) {
    const ok = window.confirm(
      `Stop repeating “${title}”? This removes the habit and its history.`,
    );
    if (!ok) return;
    setStoppingId(templateId);
    startTransition(async () => {
      setOptimistic({ type: "removeTemplate", templateId });
      try {
        await stopRecurring(templateId);
        router.refresh();
      } finally {
        setStoppingId(null);
      }
    });
  }

  function handleSaveAdd() {
    const fields = draftToRecurringFields(draft);
    setSaving(true);
    startTransition(async () => {
      try {
        await addRecurring(fields);
        closeAdd();
        router.refresh();
      } catch (err) {
        setSaving(false);
        window.alert(err?.message || "Could not add habit");
      }
    });
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Recurring / Self care</h2>
          <p className="mt-1 text-[13px] text-[#777]">
            Daily and weekly habits. Misses bubble to the top the next day.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {items.length > 0 && (
            <span className="text-[13px] text-[#777]">
              {doneCount} / {items.length} done
              {openItems.length > 0 ? ` · ${openItems.length} left` : ""}
            </span>
          )}
          {!adding && (
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="mb-3 rounded-[10px] border border-ink/25 bg-white px-3 py-3 shadow-sm">
          <div className="text-sm font-medium text-ink">New habit</div>
          <RecurringForm
            draft={draft}
            onChange={setDraft}
            onSave={handleSaveAdd}
            onCancel={closeAdd}
            saving={saving}
            submitLabel="Add"
          />
        </div>
      )}

      {openItems.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {openItems.map((item) => (
            <RecurringItem
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onStop={handleStop}
              stopping={stoppingId === item.template_id}
            />
          ))}
        </ul>
      ) : (
        !adding && (
          <p className="rounded-[10px] border border-dashed border-line bg-white/60 px-4 py-6 text-center text-sm text-[#888]">
            {items.length > 0
              ? "All done for today."
              : "No habits for today. Add one to get started."}
          </p>
        )
      )}
    </section>
  );
}
