"use client";

import type { ChartMode } from "@/lib/options";
import { cn } from "@/lib/utils";

const MODES: { id: ChartMode; label: string; hint: string }[] = [
  {
    id: "expiration",
    label: "Expiration",
    hint: "Terminal intrinsic vs entry premium",
  },
  {
    id: "markToModel",
    label: "Mark-to-model",
    hint: "Black–Scholes value vs entry at flat IV",
  },
  {
    id: "ivCrush",
    label: "IV crush",
    hint: "Pre-event vs post-crush mark P&L",
  },
];

interface ModeToggleProps {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const active = MODES.find((m) => m.id === mode) ?? MODES[0]!;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Analysis mode
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{active.hint}</p>
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Analysis mode"
        className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-muted/50 p-1"
      >
        {MODES.map((m) => {
          const selected = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? "bg-ink text-paper shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onChange(m.id)}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
