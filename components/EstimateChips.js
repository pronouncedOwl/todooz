"use client";

import { ESTIMATE_OPTIONS } from "@/lib/estimates";

export default function EstimateChips({ value, onChange }) {
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-[#777]">
        Estimate
      </span>
      <div className="flex flex-wrap gap-1.5">
        {ESTIMATE_OPTIONS.map((opt) => {
          const active = value === opt.minutes;
          return (
            <button
              key={opt.minutes}
              type="button"
              onClick={() => onChange(active ? null : opt.minutes)}
              className={[
                "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-muted hover:border-ink/30",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-[#999] hover:border-ink/30"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
