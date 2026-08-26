"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRecurring,
  saveRecurring,
  stopRecurring,
  toggleRecurring,
} from "@/app/actions";
import RecurringForm, {
  EMPTY_RECURRING_DRAFT,
  draftToRecurringFields,
} from "@/components/RecurringForm";
import { formatEstimate, formatRemainingEstimate } from "@/lib/estimates";

const WEEKDAY_BY_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function localWeekdayCode(now = new Date()) {
  return WEEKDAY_BY_INDEX[now.getDay()] || "MO";
}

function scheduleFromItem(item) {
  if (item.freq === "WEEKLY") return "weekly";
  if (Number(item.interval) > 1) return "every2";
  return "daily";
}

function itemToRecurringDraft(item) {
  return {
    ...EMPTY_RECURRING_DRAFT,
    title:
      item.template_title || item.title.replace(/\s*\(\d+\/\d+\)\s*$/, ""),
    notes: item.notes || "",
    schedule: scheduleFromItem(item),
    byweekday: Array.isArray(item.byweekday) ? [...item.byweekday] : [],
    times_per_day: item.times_per_day || 1,
    estimate_minutes: item.estimate_minutes ?? null,
  };
}

function RecurringItem({ item, onToggle, onEdit }) {
  const estimateLabel = formatEstimate(item.estimate_minutes);

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
          {estimateLabel && (
            <span className="font-medium text-[#666]">~{estimateLabel}</span>
          )}
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
        onClick={() => onEdit(item)}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[#777] hover:bg-[#f3f2ef] hover:text-ink"
      >
        Edit
      </button>
    </li>
  );
}

export default function RecurringSection({ initialItems }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
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
      if (action.type === "updateTemplate") {
        const fields = action.fields;
        const times = Math.max(1, Number(fields.times_per_day) || 1);
        return state.map((item) => {
          if (item.template_id !== action.templateId) return item;
          const title =
            times <= 1
              ? fields.title
              : `${fields.title} (${item.occurrence}/${times})`;
          return {
            ...item,
            ...fields,
            title,
            template_title: fields.title,
          };
        });
      }
      return state;
    },
  );
  const [, startTransition] = useTransition();

  const openItems = items.filter((i) => !i.completed);
  const doneCount = items.length - openItems.length;
  const remaining = formatRemainingEstimate(items);

  function closeForm() {
    setAdding(false);
    setEditingTemplateId(null);
    setDraft(EMPTY_RECURRING_DRAFT);
    setSaving(false);
  }

  function handleAdd() {
    setEditingTemplateId(null);
    setDraft({
      ...EMPTY_RECURRING_DRAFT,
      byweekday: [localWeekdayCode()],
    });
    setAdding(true);
  }

  function handleEdit(item) {
    setAdding(false);
    setEditingTemplateId(item.template_id);
    setDraft(itemToRecurringDraft(item));
  }

  function handleToggle(id, completed) {
    startTransition(async () => {
      setOptimistic({ type: "toggle", id, completed });
      await toggleRecurring(id, completed);
    });
  }

  function handleStop() {
    const title = draft.title.trim() || "this habit";
    const ok = window.confirm(
      `Stop repeating “${title}”? This removes the habit and its history.`,
    );
    if (!ok) return;
    const templateId = editingTemplateId;
    setStoppingId(templateId);
    startTransition(async () => {
      setOptimistic({ type: "removeTemplate", templateId });
      try {
        await stopRecurring(templateId);
        closeForm();
        router.refresh();
      } catch (err) {
        window.alert(err?.message || "Could not stop habit");
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
        closeForm();
        router.refresh();
      } catch (err) {
        setSaving(false);
        window.alert(err?.message || "Could not add habit");
      }
    });
  }

  function handleSaveEdit() {
    if (!editingTemplateId) return;
    const fields = draftToRecurringFields(draft);
    setSaving(true);
    startTransition(async () => {
      try {
        setOptimistic({
          type: "updateTemplate",
          templateId: editingTemplateId,
          fields,
        });
        await saveRecurring(editingTemplateId, fields);
        closeForm();
        router.refresh();
      } catch (err) {
        setSaving(false);
        window.alert(err?.message || "Could not save habit");
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
              {remaining ? ` · ${remaining}` : ""}
            </span>
          )}
          {!adding && !editingTemplateId && (
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
            onCancel={closeForm}
            saving={saving}
            submitLabel="Add"
          />
        </div>
      )}

      {editingTemplateId && (
        <div className="mb-3 rounded-[10px] border border-ink/25 bg-white px-3 py-3 shadow-sm">
          <div className="text-sm font-medium text-ink">Edit habit</div>
          <RecurringForm
            draft={draft}
            onChange={setDraft}
            onSave={handleSaveEdit}
            onCancel={closeForm}
            onStop={handleStop}
            saving={saving || Boolean(stoppingId)}
            submitLabel="Save"
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
              onEdit={handleEdit}
            />
          ))}
        </ul>
      ) : (
        !adding &&
        !editingTemplateId && (
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
