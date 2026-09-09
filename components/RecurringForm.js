"use client";

import EstimateChips from "@/components/EstimateChips";

const WEEKDAYS = [
  { code: "SU", label: "Su" },
  { code: "MO", label: "Mo" },
  { code: "TU", label: "Tu" },
  { code: "WE", label: "We" },
  { code: "TH", label: "Th" },
  { code: "FR", label: "Fr" },
  { code: "SA", label: "Sa" },
];

export const TIME_OF_DAY_OPTIONS = [
  { id: "before_wake", label: "Before wake" },
  { id: "morning", label: "Morning" },
  { id: "daytime", label: "Daytime" },
  { id: "evening", label: "Evening" },
];

export const EMPTY_RECURRING_DRAFT = {
  title: "",
  notes: "",
  schedule: "daily",
  byweekday: [],
  times_per_day: 1,
  estimate_minutes: null,
  time_of_day: "daytime",
  time_slots: ["daytime"],
};

function fieldClassName() {
  return "mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink/40";
}

function TimeOfDayChips({ value, onChange, label }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-muted">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {TIME_OF_DAY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={[
              "rounded-full border px-3 py-1 text-[13px] transition-colors",
              value === opt.id
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-muted hover:border-ink/30",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Map UI draft → createRecurringTemplate / promote payload. */
export function draftToRecurringFields(draft) {
  const title = String(draft.title ?? "").trim();
  const notes = typeof draft.notes === "string" ? draft.notes : "";
  const times = Math.max(1, Math.min(20, Number(draft.times_per_day) || 1));
  const schedule = draft.schedule || "daily";
  const time_of_day = draft.time_of_day || "daytime";
  const slots = Array.isArray(draft.time_slots) ? draft.time_slots : [];
  const time_slots = Array.from({ length: times }, (_, i) => {
    const slot = slots[i] ?? slots[slots.length - 1] ?? time_of_day;
    return slot || time_of_day;
  });

  const estimate_minutes = draft.estimate_minutes ?? null;

  const base = {
    title,
    notes,
    times_per_day: times,
    estimate_minutes,
    time_of_day,
    time_slots,
  };

  if (schedule === "weekly") {
    return {
      ...base,
      freq: "WEEKLY",
      interval: 1,
      byweekday: Array.isArray(draft.byweekday) ? draft.byweekday : [],
    };
  }

  if (schedule === "every2") {
    return {
      ...base,
      freq: "DAILY",
      interval: 2,
    };
  }

  return {
    ...base,
    freq: "DAILY",
    interval: 1,
  };
}

export default function RecurringForm({
  draft,
  onChange,
  onSave,
  onCancel,
  onStop,
  saving,
  submitLabel = "Add",
  titleEditable = true,
}) {
  function toggleWeekday(code) {
    const current = Array.isArray(draft.byweekday) ? draft.byweekday : [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    onChange({ ...draft, byweekday: next });
  }

  function setTimesPerDay(raw) {
    const times = Math.max(1, Math.min(20, Number(raw) || 1));
    const prev = Array.isArray(draft.time_slots) ? draft.time_slots : [];
    const fallback = draft.time_of_day || "daytime";
    const time_slots = Array.from(
      { length: times },
      (_, i) => prev[i] ?? prev[prev.length - 1] ?? fallback,
    );
    onChange({ ...draft, times_per_day: times, time_slots });
  }

  function setSingleTimeOfDay(time_of_day) {
    const times = Math.max(1, Number(draft.times_per_day) || 1);
    onChange({
      ...draft,
      time_of_day,
      time_slots: Array.from({ length: times }, () => time_of_day),
    });
  }

  function setSlot(index, slot) {
    const times = Math.max(1, Number(draft.times_per_day) || 1);
    const prev = Array.isArray(draft.time_slots) ? [...draft.time_slots] : [];
    while (prev.length < times) {
      prev.push(draft.time_of_day || "daytime");
    }
    prev[index] = slot;
    onChange({
      ...draft,
      time_slots: prev,
      // Keep template default aligned with first slot for single-slot habits.
      time_of_day: index === 0 ? slot : draft.time_of_day || slot,
    });
  }

  const weeklyNeedsDay =
    draft.schedule === "weekly" &&
    (!Array.isArray(draft.byweekday) || draft.byweekday.length === 0);

  const times = Math.max(1, Number(draft.times_per_day) || 1);

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.title.trim() || weeklyNeedsDay || saving) return;
        onSave();
      }}
    >
      {titleEditable && (
        <label className="block text-[13px] font-medium text-muted">
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            className={fieldClassName()}
            placeholder="Habit name"
            autoFocus
            required
          />
        </label>
      )}

      <label className="block text-[13px] font-medium text-muted">
        Notes
        <textarea
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          rows={2}
          placeholder="Optional"
          className={`${fieldClassName()} min-h-[64px] resize-y leading-relaxed`}
        />
      </label>

      <fieldset>
        <legend className="text-[13px] font-medium text-muted">Schedule</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[
            { id: "daily", label: "Every day" },
            { id: "every2", label: "Every 2 days" },
            { id: "weekly", label: "Weekly" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ ...draft, schedule: opt.id })}
              className={[
                "rounded-full border px-3 py-1 text-[13px] transition-colors",
                draft.schedule === opt.id
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-muted hover:border-ink/30",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {draft.schedule === "weekly" && (
        <fieldset>
          <legend className="text-[13px] font-medium text-muted">Days</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => {
              const active = (draft.byweekday || []).includes(day.code);
              return (
                <button
                  key={day.code}
                  type="button"
                  onClick={() => toggleWeekday(day.code)}
                  className={[
                    "h-8 w-8 rounded-full border text-[12px] font-medium transition-colors",
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-muted hover:border-ink/30",
                  ].join(" ")}
                  aria-pressed={active}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <label className="block text-[13px] font-medium text-muted">
        Times per day
        <input
          type="number"
          min={1}
          max={20}
          value={draft.times_per_day}
          onChange={(e) => setTimesPerDay(e.target.value)}
          className={`${fieldClassName()} max-w-[6rem]`}
        />
      </label>

      {times <= 1 ? (
        <TimeOfDayChips
          label="Time of day"
          value={draft.time_of_day || "daytime"}
          onChange={setSingleTimeOfDay}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: times }, (_, i) => {
            const slots = Array.isArray(draft.time_slots)
              ? draft.time_slots
              : [];
            const value =
              slots[i] ?? slots[slots.length - 1] ?? draft.time_of_day ?? "daytime";
            return (
              <TimeOfDayChips
                key={i}
                label={`Occurrence ${i + 1} time of day`}
                value={value}
                onChange={(slot) => setSlot(i, slot)}
              />
            );
          })}
        </div>
      )}

      <EstimateChips
        value={draft.estimate_minutes}
        onChange={(estimate_minutes) => onChange({ ...draft, estimate_minutes })}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !draft.title.trim() || weeklyNeedsDay}
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
        {onStop && (
          <button
            type="button"
            onClick={onStop}
            disabled={saving}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] text-muted hover:border-ink/30 hover:text-ink disabled:opacity-40"
          >
            Stop
          </button>
        )}
      </div>
    </form>
  );
}
