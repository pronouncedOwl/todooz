"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRecurring,
  closeMorningBlock,
  saveRecurring,
  skipRecurring,
  stopRecurring,
  toggleRecurring,
} from "@/app/actions";
import RecurringForm, {
  EMPTY_RECURRING_DRAFT,
  draftToRecurringFields,
} from "@/components/RecurringForm";
import { isPastMorningCutoff } from "@/lib/dates";
import { formatEstimate, formatRemainingEstimate } from "@/lib/estimates";

const WEEKDAY_BY_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const TIME_SECTIONS = [
  { id: "before_wake", label: "Before wake" },
  { id: "morning", label: "Morning" },
  { id: "daytime", label: "Daytime" },
  { id: "evening", label: "Evening" },
  { id: "before_bed", label: "Before bed" },
];

function localWeekdayCode(now = new Date()) {
  return WEEKDAY_BY_INDEX[now.getDay()] || "MO";
}

function scheduleFromItem(item) {
  if (item.freq === "WEEKLY") return "weekly";
  if (Number(item.interval) > 1) return "every2";
  return "daily";
}

function itemToRecurringDraft(item) {
  const times = Math.max(1, Number(item.times_per_day) || 1);
  const fallback = item.template_time_of_day || item.time_of_day || "daytime";
  const slots = Array.isArray(item.time_slots) && item.time_slots.length > 0
    ? item.time_slots
    : Array.from({ length: times }, () => fallback);

  return {
    ...EMPTY_RECURRING_DRAFT,
    title:
      item.template_title || item.title.replace(/\s*\(\d+\/\d+\)\s*$/, ""),
    notes: item.notes || "",
    schedule: scheduleFromItem(item),
    byweekday: Array.isArray(item.byweekday) ? [...item.byweekday] : [],
    times_per_day: times,
    estimate_minutes: item.estimate_minutes ?? null,
    time_of_day: fallback,
    time_slots: Array.from({ length: times }, (_, i) => slots[i] ?? fallback),
  };
}

function isVisibleOpen(item) {
  return !item.completed && item.status === "open";
}

function RecurringItem({ item, onToggle, onSkip, onEdit }) {
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
        {!item.completed && (
          <button
            type="button"
            onClick={() => onSkip(item.id)}
            className="mt-1.5 text-[12px] font-medium text-[#888] underline-offset-2 hover:text-ink hover:underline"
          >
            Skip habit for today
          </button>
        )}
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

function MorningCloseoutDialog({ items, resolving, onResolve }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-closeout-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-xl">
        <h3
          id="morning-closeout-title"
          className="text-lg font-semibold text-ink"
        >
          Morning block is over
        </h3>
        <p className="mt-2 text-sm text-[#555]">
          These morning habits are still open. Mark them complete or mark them
          missed — then the morning section hides until tomorrow.
        </p>
        <ul className="mt-3 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-ink">
          {items.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve("complete")}
            className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {resolving ? "Saving…" : "Mark complete"}
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => onResolve("missed")}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] font-medium text-muted hover:border-ink/30 hover:text-ink disabled:opacity-40"
          >
            Mark missed
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecurringSection({
  initialItems,
  morningClosedOn = null,
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_RECURRING_DRAFT);
  const [saving, setSaving] = useState(false);
  const [stoppingId, setStoppingId] = useState(null);
  const [closedOverride, setClosedOverride] = useState(null);
  const [pastCutoff, setPastCutoff] = useState(false);
  const [resolvingMorning, setResolvingMorning] = useState(false);
  const [items, setOptimistic] = useOptimistic(
    initialItems,
    (state, action) => {
      if (action.type === "toggle") {
        return state.map((item) =>
          item.id === action.id
            ? { ...item, completed: action.completed, status: "open" }
            : item,
        );
      }
      if (action.type === "skip") {
        return state.map((item) =>
          item.id === action.id
            ? { ...item, completed: false, status: "skipped" }
            : item,
        );
      }
      if (action.type === "removeTemplate") {
        return state.filter((item) => item.template_id !== action.templateId);
      }
      if (action.type === "updateTemplate") {
        const fields = action.fields;
        const times = Math.max(1, Number(fields.times_per_day) || 1);
        const slots = Array.isArray(fields.time_slots)
          ? fields.time_slots
          : null;
        return state.map((item) => {
          if (item.template_id !== action.templateId) return item;
          const title =
            times <= 1
              ? fields.title
              : `${fields.title} (${item.occurrence}/${times})`;
          const slot =
            slots?.[item.occurrence - 1] ??
            slots?.[slots.length - 1] ??
            fields.time_of_day ??
            item.time_of_day;
          return {
            ...item,
            ...fields,
            title,
            template_title: fields.title,
            template_time_of_day: fields.time_of_day,
            time_of_day: slot,
            time_slots: slots,
          };
        });
      }
      if (action.type === "resolveMorning") {
        return state.map((item) => {
          if (item.time_of_day !== "morning" || !isVisibleOpen(item)) {
            return item;
          }
          if (action.resolution === "complete") {
            return { ...item, completed: true, status: "open" };
          }
          return { ...item, completed: false, status: "incomplete" };
        });
      }
      return state;
    },
  );
  const [, startTransition] = useTransition();

  const closedOn = closedOverride ?? morningClosedOn;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPastCutoff(isPastMorningCutoff());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const openItems = items.filter(isVisibleOpen);
  const doneCount = items.filter((i) => i.completed).length;
  const remaining = formatRemainingEstimate(openItems);

  const morningOpen = openItems.filter((i) => i.time_of_day === "morning");
  const todayDate = items[0]?.date;
  const morningClosedToday = Boolean(
    closedOn && todayDate && closedOn === todayDate,
  );

  const showMorningDialog =
    pastCutoff &&
    !morningClosedToday &&
    (morningOpen.length > 0 || resolvingMorning);

  const sections = useMemo(() => {
    return TIME_SECTIONS.map((section) => {
      const allForSection = items.filter(
        (i) => (i.time_of_day || "daytime") === section.id,
      );
      const openForSection = allForSection
        .filter(isVisibleOpen)
        .sort((a, b) => {
          if (b.miss_streak !== a.miss_streak) return b.miss_streak - a.miss_streak;
          if (a.title !== b.title) return a.title.localeCompare(b.title);
          return a.occurrence - b.occurrence;
        });
      return {
        ...section,
        total: allForSection.length,
        openItems: openForSection,
        complete: allForSection.length > 0 && openForSection.length === 0,
      };
    }).filter((section) => section.total > 0);
  }, [items]);

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
      router.refresh();
    });
  }

  function handleSkip(id) {
    startTransition(async () => {
      setOptimistic({ type: "skip", id });
      await skipRecurring(id);
      router.refresh();
    });
  }

  function handleMorningResolve(resolution) {
    setResolvingMorning(true);
    startTransition(async () => {
      try {
        setOptimistic({ type: "resolveMorning", resolution });
        const result = await closeMorningBlock(resolution);
        setClosedOverride(result.morning_closed_on);
        router.refresh();
      } catch (err) {
        window.alert(err?.message || "Could not close morning block");
      } finally {
        setResolvingMorning(false);
      }
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
      {showMorningDialog && (
        <MorningCloseoutDialog
          items={morningOpen}
          resolving={resolvingMorning}
          onResolve={handleMorningResolve}
        />
      )}

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Recurring / Self care</h2>
          <p className="mt-1 text-[13px] text-[#777]">
            Daily and weekly habits by morning, daytime, and evening.
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

      {sections.length > 0 ? (
        <div className="flex flex-col gap-5">
          {sections.map((section) =>
            section.complete ? (
              <div
                key={section.id}
                className="rounded-[10px] border border-[#ddd] bg-[#f7f6f3] px-3 py-2.5"
              >
                <p className="text-[13px] font-medium text-[#555]">
                  {section.label} — complete
                </p>
              </div>
            ) : (
              <div key={section.id}>
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#777]">
                  {section.label}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {section.openItems.map((item) => (
                    <RecurringItem
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onSkip={handleSkip}
                      onEdit={handleEdit}
                    />
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
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

      {!adding && !editingTemplateId && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
          >
            Add Recurring
          </button>
        </div>
      )}
    </section>
  );
}
