"use client";

import { STRATEGY_PRESETS } from "@/lib/options";
import { cn } from "@/lib/utils";

interface StrategyPresetsProps {
  activePresetId: string | null;
  onSelect: (presetId: string) => void;
  onClear: () => void;
}

export function StrategyPresets({
  activePresetId,
  onSelect,
  onClear,
}: StrategyPresetsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Strategy presets
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Load a structure, then edit any leg.
          </p>
        </div>
        {activePresetId ? (
          <span className="animate-fade-up inline-flex items-center rounded-md border border-teal/25 bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {STRATEGY_PRESETS.find((p) => p.id === activePresetId)?.shortName ??
              "Custom"}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {STRATEGY_PRESETS.map((preset) => {
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              className={cn(
                "h-8 rounded-md border px-2.5 text-[0.8rem] font-medium transition-colors",
                active
                  ? "border-teal bg-teal text-primary-foreground"
                  : "border-border bg-paper text-foreground hover:bg-muted",
              )}
              onClick={() => onSelect(preset.id)}
            >
              {preset.shortName}
            </button>
          );
        })}
        <button
          type="button"
          className="h-8 rounded-md px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClear}
        >
          Clear book
        </button>
      </div>
    </div>
  );
}
