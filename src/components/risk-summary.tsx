"use client";

import {
  formatBound,
  formatMoney,
  formatPrice,
  netPremiumLabel,
  pnlTone,
  type RiskMetrics,
} from "@/lib/options";
import { cn } from "@/lib/utils";

interface RiskSummaryProps {
  metrics: RiskMetrics;
  spot: number;
  hasLegs: boolean;
}

function MetricCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "flat" | "neutral";
  hint?: string;
}) {
  return (
    <div className="animate-fade-up min-w-0">
      <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "metric-value mt-1 text-[1.35rem] sm:text-2xl",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "flat" && "text-graphite",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function RiskSummary({ metrics, spot, hasLegs }: RiskSummaryProps) {
  if (!hasLegs) {
    return (
      <div className="panel p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
          Expiration risk
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No legs yet. Load a preset to see max profit, max loss, and
          breakevens on the expiration curve.
        </p>
      </div>
    );
  }

  const premium = netPremiumLabel(metrics.netPremium);
  const spotTone = pnlTone(metrics.pnlAtSpot);
  const profitTone =
    metrics.maxProfit.kind === "unlimited"
      ? "profit"
      : pnlTone(metrics.maxProfit.value);
  const lossTone =
    metrics.maxLoss.kind === "unlimited"
      ? "loss"
      : pnlTone(metrics.maxLoss.value);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
          Expiration risk
        </h2>
        <span className="font-tabular text-xs text-muted-foreground">
          Spot {formatPrice(spot)} · terminal
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-3">
        <MetricCard
          label="Max profit"
          value={formatBound(metrics.maxProfit)}
          tone={profitTone}
        />
        <MetricCard
          label="Max loss"
          value={formatBound(metrics.maxLoss)}
          tone={lossTone}
        />
        <MetricCard
          label="P&L at spot"
          value={formatMoney(metrics.pnlAtSpot, { signed: true })}
          tone={spotTone}
          hint="If underlying expires at reference spot"
        />
        <MetricCard
          label="Net premium"
          value={
            premium.tone === "flat"
              ? "Flat"
              : formatMoney(Math.abs(metrics.netPremium), { signed: false })
          }
          tone={
            premium.tone === "credit"
              ? "profit"
              : premium.tone === "debit"
                ? "loss"
                : "flat"
          }
          hint={
            premium.tone === "credit"
              ? "Credit received at open"
              : premium.tone === "debit"
                ? "Debit paid at open"
                : "No net premium"
          }
        />
        <div className="col-span-2 animate-fade-up lg:col-span-2">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Breakevens
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {metrics.breakevens.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                None on sampled curve
              </span>
            ) : (
              metrics.breakevens.map((be) => (
                <span
                  key={be}
                  className="font-tabular rounded-md border border-border bg-paper px-2 py-1 text-sm font-medium text-ink"
                >
                  {formatPrice(be)}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
