"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function ExportDump({ json }) {
  const [status, setStatus] = useState("idle");
  const resetTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function scheduleReset() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 2000);
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(json);
      setStatus("copied");
      scheduleReset();
    } catch {
      setStatus("failed");
      scheduleReset();
    }
  }

  const buttonLabel =
    status === "copied"
      ? "Copied"
      : status === "failed"
        ? "Copy failed"
        : "Copy JSON";

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Export for planning</h1>
          <p className="mt-1 text-[13px] text-[#777]">
            Incomplete todos plus today&apos;s open recurring items. Copy below,
            or select the JSON if clipboard is blocked.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-muted hover:border-ink/30"
        >
          Back
        </Link>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-ink bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
        >
          {buttonLabel}
        </button>
        {status === "failed" && (
          <span className="text-[13px] text-[#b23b3b]">
            Select the text below and copy manually.
          </span>
        )}
      </div>

      <pre
        tabIndex={0}
        className="overflow-x-auto rounded-[10px] border border-[#eee] bg-white px-3 py-3 text-[12px] leading-relaxed text-ink whitespace-pre-wrap break-words select-text"
      >
        {json}
      </pre>
    </div>
  );
}
