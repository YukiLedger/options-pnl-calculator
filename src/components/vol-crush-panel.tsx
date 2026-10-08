"use client";

import { NumberInput } from "@/components/number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatMoney,
  type CrushStressResult,
  type VolParams,
} from "@/lib/options";
import { cn } from "@/lib/utils";

interface VolCrushPanelProps {
  vol: VolParams;
  crush: CrushStressResult;
  showCrushMetrics: boolean;
  onChange: (patch: Partial<VolParams>) => void;
}

export function VolCrushPanel({
  vol,
  crush,
  showCrushMetrics,
  onChange,
}: VolCrushPanelProps) {
  const ivPct = Number((vol.iv * 100).toFixed(2));
  const crushPct = Number((vol.crushPct * 100).toFixed(1));
  const ratePct = Number((vol.rate * 100).toFixed(2));
  const qPct = Number((vol.dividendYield * 100).toFixed(2));

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            Flat IV &amp; event stress
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Black–Scholes marks with a single session IV. Crush scales IV by
            (1 − magnitude) — no skew.
          </p>
        </div>
        {vol.eventLabel ? (
          <span className="rounded-md border border-teal/25 bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {vol.eventLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <Label htmlFor="iv" className="text-xs">
            Pre-event IV %
          </Label>
          <NumberInput
            id="iv"
            step="1"
            min={0.1}
            className="font-tabular mt-1 h-8"
            value={ivPct}
            onValueChange={(v) => onChange({ iv: v / 100 })}
            aria-invalid={crush.errors.some((e) => e.includes("Implied vol"))}
          />
        </div>
        <div>
          <Label htmlFor="dte" className="text-xs">
            Days to expiry
          </Label>
          <NumberInput
            id="dte"
            step="1"
            min={1}
            className="font-tabular mt-1 h-8"
            value={vol.daysToExpiry}
            onValueChange={(daysToExpiry) => onChange({ daysToExpiry })}
          />
        </div>
        <div>
          <Label htmlFor="crush" className="text-xs">
            Crush magnitude %
          </Label>
          <NumberInput
            id="crush"
            step="5"
            min={0}
            max={100}
            className="font-tabular mt-1 h-8"
            value={crushPct}
            onValueChange={(v) => onChange({ crushPct: v / 100 })}
          />
        </div>
        <div>
          <Label htmlFor="event" className="text-xs">
            Event label
          </Label>
          <Input
            id="event"
            className="mt-1 h-8"
            value={vol.eventLabel}
            maxLength={24}
            placeholder="Earnings"
            onChange={(e) => onChange({ eventLabel: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="rate" className="text-xs">
            Rate %
          </Label>
          <NumberInput
            id="rate"
            step="0.25"
            className="font-tabular mt-1 h-8"
            value={ratePct}
            onValueChange={(v) => onChange({ rate: v / 100 })}
          />
        </div>
        <div>
          <Label htmlFor="div" className="text-xs">
            Div yield %
          </Label>
          <NumberInput
            id="div"
            step="0.25"
            min={0}
            className="font-tabular mt-1 h-8"
            value={qPct}
            onValueChange={(v) => onChange({ dividendYield: v / 100 })}
          />
        </div>
      </div>

      {crush.errors.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-loss">
          {crush.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      {showCrushMetrics && crush.ok ? (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-4 sm:grid-cols-4">
          <Metric
            label="Pre-event IV"
            value={`${(crush.preIv * 100).toFixed(1)}%`}
          />
          <Metric
            label="Post-crush IV"
            value={`${(crush.postIv * 100).toFixed(1)}%`}
            hint={`× (1 − ${crushPct}%)`}
          />
          <Metric
            label="P&L before"
            value={formatMoney(crush.prePnl, { signed: true })}
            tone={crush.prePnl >= 0 ? "profit" : "loss"}
          />
          <Metric
            label="P&L after"
            value={formatMoney(crush.postPnl, { signed: true })}
            tone={crush.postPnl >= 0 ? "profit" : "loss"}
          />
          <Metric
            label="Crush Δ P&L"
            value={formatMoney(crush.crushPnl, { signed: true })}
            tone={crush.crushPnl >= 0 ? "profit" : "loss"}
            hint="At unchanged spot"
          />
          <Metric
            label="Book vega"
            value={formatMoney(crush.vegaPerVolPoint, { signed: true })}
            hint="Per 1 vol point"
          />
          <div className="col-span-2 sm:col-span-2">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Vega posture
            </div>
            <p className="mt-1 text-sm text-ink">
              {crush.shortVega ? "Short vega" : "Long vega"} —{" "}
              {crush.shortVega
                ? "crush tends to help if spot is unchanged."
                : "crush can erase premium even without an adverse move."}
            </p>
          </div>
        </div>
      ) : null}

      {showCrushMetrics && crush.ok && crush.canLoseIfUnderlyingFavorable ? (
        <div className="mt-3 rounded-md border border-loss/30 bg-loss/5 px-3 py-2 text-sm text-loss">
          Can lose even if the underlying goes your way — long vega into a{" "}
          {vol.eventLabel || "event"} crush of {crushPct}%.
        </div>
      ) : null}

      {showCrushMetrics && crush.ok && crush.shortVega ? (
        <div className="mt-3 rounded-md border border-teal/30 bg-accent/60 px-3 py-2 text-sm text-accent-foreground">
          Short vol into {vol.eventLabel || "the event"}: crush of {crushPct}%
          improves mark P&L by{" "}
          <span className="font-tabular font-semibold">
            {formatMoney(crush.crushPnl, { signed: true })}
          </span>{" "}
          at spot — the remaining risk is a large underlying move.
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "font-tabular mt-1 text-lg font-semibold text-ink",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
