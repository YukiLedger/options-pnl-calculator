"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatMoney,
  netPremiumLabel,
  sideSign,
  type OptionLeg,
  type StrategyValidation,
} from "@/lib/options";
import { cn } from "@/lib/utils";
import { Copy, Plus, Trash2 } from "lucide-react";

interface LegEditorProps {
  legs: OptionLeg[];
  validation: StrategyValidation;
  onChange: (legId: string, patch: Partial<OptionLeg>) => void;
  onAdd: () => void;
  onRemove: (legId: string) => void;
  onDuplicate: (legId: string) => void;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-border bg-muted/60 p-0.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-ink text-paper shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function legCash(leg: OptionLeg): number {
  return -sideSign(leg.side) * leg.premium * leg.quantity * leg.multiplier;
}

export function LegEditor({
  legs,
  validation,
  onChange,
  onAdd,
  onRemove,
  onDuplicate,
}: LegEditorProps) {
  const netCash = legs.reduce(
    (s, l) => s + -sideSign(l.side) * l.premium * l.quantity * l.multiplier,
    0,
  );
  const premiumLabel = netPremiumLabel(-netCash);

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Leg book
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Call/put, buy/sell, strike, premium per share.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Net open
          </div>
          <div
            className={cn(
              "font-tabular text-sm font-semibold",
              premiumLabel.tone === "credit" && "text-profit",
              premiumLabel.tone === "debit" && "text-loss",
            )}
          >
            {legs.length === 0 ? "—" : premiumLabel.label}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3 sm:p-4">
        {legs.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-paper/70 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Empty book. Load an Iron Condor or add a blank leg.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md bg-teal px-3 text-sm font-medium text-primary-foreground hover:bg-teal/90"
              onClick={onAdd}
            >
              <Plus className="size-4" />
              Add leg
            </button>
          </div>
        ) : (
          legs.map((leg, index) => {
            const issues = validation.issues.filter((i) => i.legId === leg.id);
            const cash = legCash(leg);
            return (
              <div
                key={leg.id}
                className="animate-fade-up rounded-md border border-border/80 bg-paper/80 p-3"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      L{index + 1}
                    </span>
                    <Segmented
                      ariaLabel="Side"
                      value={leg.side}
                      onChange={(side) => onChange(leg.id, { side })}
                      options={[
                        { value: "long", label: "Buy" },
                        { value: "short", label: "Sell" },
                      ]}
                    />
                    <Segmented
                      ariaLabel="Option type"
                      value={leg.type}
                      onChange={(type) => onChange(leg.id, { type })}
                      options={[
                        { value: "call", label: "Call" },
                        { value: "put", label: "Put" },
                      ]}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "font-tabular mr-1 text-xs font-medium",
                        cash > 0 && "text-profit",
                        cash < 0 && "text-loss",
                      )}
                    >
                      {cash === 0
                        ? "Flat"
                        : cash > 0
                          ? `+${formatMoney(cash)}`
                          : formatMoney(cash)}
                    </span>
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Duplicate leg"
                      onClick={() => onDuplicate(leg.id)}
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove leg"
                      onClick={() => onRemove(leg.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <Label htmlFor={`${leg.id}-strike`} className="text-xs">
                      Strike
                    </Label>
                    <Input
                      id={`${leg.id}-strike`}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      className="font-tabular mt-1 h-8"
                      value={Number.isFinite(leg.strike) ? leg.strike : ""}
                      onChange={(e) =>
                        onChange(leg.id, {
                          strike: Number(e.target.value),
                        })
                      }
                      aria-invalid={issues.some((i) => i.field === "strike")}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${leg.id}-premium`} className="text-xs">
                      Premium
                    </Label>
                    <Input
                      id={`${leg.id}-premium`}
                      type="number"
                      inputMode="decimal"
                      step="0.05"
                      min="0"
                      className="font-tabular mt-1 h-8"
                      value={Number.isFinite(leg.premium) ? leg.premium : ""}
                      onChange={(e) =>
                        onChange(leg.id, {
                          premium: Number(e.target.value),
                        })
                      }
                      aria-invalid={issues.some((i) => i.field === "premium")}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${leg.id}-qty`} className="text-xs">
                      Qty
                    </Label>
                    <Input
                      id={`${leg.id}-qty`}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      className="font-tabular mt-1 h-8"
                      value={Number.isFinite(leg.quantity) ? leg.quantity : ""}
                      onChange={(e) =>
                        onChange(leg.id, {
                          quantity: Number(e.target.value),
                        })
                      }
                      aria-invalid={issues.some((i) => i.field === "quantity")}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${leg.id}-mult`} className="text-xs">
                      Mult
                    </Label>
                    <Input
                      id={`${leg.id}-mult`}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      className="font-tabular mt-1 h-8"
                      value={
                        Number.isFinite(leg.multiplier) ? leg.multiplier : ""
                      }
                      onChange={(e) =>
                        onChange(leg.id, {
                          multiplier: Number(e.target.value),
                        })
                      }
                      aria-invalid={issues.some((i) => i.field === "multiplier")}
                    />
                  </div>
                </div>
                {issues.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-loss">
                    {issues.map((issue) => (
                      <li key={`${issue.field}-${issue.message}`}>
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {legs.length > 0 ? (
        <div className="border-t border-border/70 px-3 py-3 sm:px-4">
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-paper text-sm font-medium hover:bg-muted"
            onClick={onAdd}
          >
            <Plus className="size-4" />
            Add leg
          </button>
          {validation.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {validation.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
