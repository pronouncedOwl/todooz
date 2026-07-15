"use client";

import { useOptimistic, useTransition } from "react";
import { toggleRecurring } from "@/app/actions";

function RecurringItem({ item, onToggle }) {
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
    </li>
  );
}

export default function RecurringSection({ initialItems }) {
  const [items, setOptimistic] = useOptimistic(
    initialItems,
    (state, { id, completed }) =>
      state
        .map((item) => (item.id === id ? { ...item, completed } : item))
        .sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (b.miss_streak !== a.miss_streak) return b.miss_streak - a.miss_streak;
          if (a.title !== b.title) return a.title.localeCompare(b.title);
          return a.occurrence - b.occurrence;
        }),
  );
  const [, startTransition] = useTransition();

  const openCount = items.filter((i) => !i.completed).length;
  const doneCount = items.filter((i) => i.completed).length;

  function handleToggle(id, completed) {
    startTransition(async () => {
      setOptimistic({ id, completed });
      await toggleRecurring(id, completed);
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Recurring / Self care</h2>
          <p className="mt-1 text-[13px] text-[#777]">
            Daily and weekly habits. Misses bubble to the top the next day.
          </p>
        </div>
        <span className="shrink-0 text-[13px] text-[#777]">
          {doneCount} / {items.length} done
          {openCount > 0 ? ` · ${openCount} left` : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <RecurringItem key={item.id} item={item} onToggle={handleToggle} />
        ))}
      </ul>
    </section>
  );
}
