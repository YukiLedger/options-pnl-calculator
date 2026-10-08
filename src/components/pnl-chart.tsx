"use client";

import { useTheme } from "@/components/theme-provider";
import {
  bookPayoffAt,
  formatMoney,
  formatPrice,
  sampleCrushCurves,
  sampleMarkCurve,
  samplePayoffCurve,
  type ChartMode,
  type OptionLeg,
  type RiskMetrics,
  type VolParams,
} from "@/lib/options";
import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PnlChartProps {
  legs: OptionLeg[];
  spot: number;
  metrics: RiskMetrics;
  chartKey: string;
  mode: ChartMode;
  vol: VolParams;
  volOk: boolean;
}

type ChartRow = {
  underlying: number;
  pnl?: number;
  prePnl?: number;
  postPnl?: number;
  profit?: number;
  loss?: number;
};

function ChartTooltip({
  active,
  payload,
  mode,
  eventLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  mode: ChartMode;
  eventLabel: string;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-paper px-3 py-2 shadow-sm">
      <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {mode === "expiration"
          ? "At expiration"
          : mode === "ivCrush"
            ? `${eventLabel || "Event"} marks`
            : "Mark-to-model"}
      </div>
      <div className="font-tabular mt-1 text-sm text-ink">
        S {formatPrice(row.underlying)}
      </div>
      {mode === "ivCrush" ? (
        <>
          <div className="font-tabular text-sm text-ink">
            Pre-event{" "}
            <span className="font-semibold">
              {formatMoney(row.prePnl ?? 0, { signed: true })}
            </span>
          </div>
          <div className="font-tabular text-sm text-teal">
            Post-crush{" "}
            <span className="font-semibold">
              {formatMoney(row.postPnl ?? 0, { signed: true })}
            </span>
          </div>
        </>
      ) : (
        <div
          className={`font-tabular text-sm font-semibold ${
            (row.pnl ?? 0) >= 0 ? "text-profit" : "text-loss"
          }`}
        >
          P&L {formatMoney(row.pnl ?? 0, { signed: true })}
        </div>
      )}
    </div>
  );
}

export function PnlChart({
  legs,
  spot,
  metrics,
  chartKey,
  mode,
  vol,
  volOk,
}: PnlChartProps) {
  const [showTable, setShowTable] = useState(false);
  const { theme } = useTheme();
  const dark = theme === "dark";
  const tickFill = dark ? "#8fa0b3" : "#5a6b7d";
  const axisStroke = dark ? "#2a3748" : "#c9d4df";
  const gridStroke = dark ? "rgba(231,238,246,0.08)" : "rgba(20,32,51,0.08)";
  const inkStroke = dark ? "#e7eef6" : "#142033";
  const tealStroke = dark ? "#2bb8a8" : "#0f766e";
  const strikeStroke = dark ? "rgba(154,171,188,0.35)" : "rgba(61,74,92,0.35)";
  const zeroStroke = dark ? "#64748b" : "#94a3b8";

  const data = useMemo((): ChartRow[] => {
    if (legs.length === 0) return [];
    if (mode === "expiration") {
      return samplePayoffCurve(legs, spot, { points: 161, pad: 0.28 }).map(
        (p) => ({
          ...p,
          profit: p.pnl >= 0 ? p.pnl : 0,
          loss: p.pnl < 0 ? p.pnl : 0,
        }),
      );
    }
    if (!volOk) return [];
    if (mode === "markToModel") {
      return sampleMarkCurve(legs, spot, vol.iv, vol, {
        points: 161,
        pad: 0.28,
      }).map((p) => ({
        ...p,
        profit: p.pnl >= 0 ? p.pnl : 0,
        loss: p.pnl < 0 ? p.pnl : 0,
      }));
    }
    const { merged } = sampleCrushCurves(legs, spot, vol, {
      points: 161,
      pad: 0.28,
    });
    return merged;
  }, [legs, spot, mode, vol, volOk]);

  if (legs.length === 0) {
    return (
      <div className="panel flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
        <h2 className="font-heading text-xl font-semibold text-ink">
          P&L curve
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Load a strategy to plot expiration payoff or mark-to-model IV crush.
          Iron Condor and Long Straddle are strong demos.
        </p>
      </div>
    );
  }

  if ((mode === "markToModel" || mode === "ivCrush") && !volOk) {
    return (
      <div className="panel flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
        <h2 className="font-heading text-xl font-semibold text-ink">
          Mark-to-model unavailable
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Enter a positive implied vol and days to expiry to price the book.
          Expiration mode still works without IV.
        </p>
      </div>
    );
  }

  const strikes = [...new Set(legs.map((l) => l.strike))].sort((a, b) => a - b);
  const yValues =
    mode === "ivCrush"
      ? data.flatMap((d) => [d.prePnl ?? 0, d.postPnl ?? 0])
      : data.map((d) => d.pnl ?? 0);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 0);
  const pad = Math.max((yMax - yMin) * 0.12, 50);

  const title =
    mode === "expiration"
      ? "Expiration P&L"
      : mode === "markToModel"
        ? "Mark-to-model P&L"
        : "IV crush — pre vs post";

  const subtitle =
    mode === "expiration"
      ? "Terminal intrinsic vs entry premium. Guides mark spot, strikes, and breakevens."
      : mode === "markToModel"
        ? `Black–Scholes P&L vs entry at flat IV ${(vol.iv * 100).toFixed(0)}%, ${vol.daysToExpiry} DTE.`
        : `Pre-event IV ${(vol.iv * 100).toFixed(0)}% vs post-crush ${(vol.iv * (1 - vol.crushPct) * 100).toFixed(0)}% — same spot axis, two marks.`;

  const tableRows =
    mode === "ivCrush"
      ? [
          {
            label: "Spot",
            x: spot,
            pre: data.find((d) => Math.abs(d.underlying - spot) < 1e-9)?.prePnl ?? 0,
            post:
              data.find((d) => Math.abs(d.underlying - spot) < 1e-9)?.postPnl ?? 0,
          },
          ...strikes.map((k) => ({
            label: `Strike ${formatPrice(k, 0)}`,
            x: k,
            pre:
              data.find((d) => Math.abs(d.underlying - k) < 1e-9)?.prePnl ?? 0,
            post:
              data.find((d) => Math.abs(d.underlying - k) < 1e-9)?.postPnl ?? 0,
          })),
        ]
      : [
          {
            label: "Spot",
            x: spot,
            pnl:
              mode === "expiration"
                ? metrics.pnlAtSpot
                : (data.find((d) => Math.abs(d.underlying - spot) < 1e-9)?.pnl ??
                  0),
          },
          ...strikes.map((k) => ({
            label: `Strike ${formatPrice(k, 0)}`,
            x: k,
            pnl:
              mode === "expiration"
                ? bookPayoffAt(legs, k)
                : (data.find((d) => Math.abs(d.underlying - k) < 1e-9)?.pnl ?? 0),
          })),
          ...(mode === "expiration"
            ? metrics.breakevens.map((be, i) => ({
                label: `BE ${i + 1}`,
                x: be,
                pnl: 0,
              }))
            : []),
        ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {mode === "ivCrush" ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-4 bg-ink/70" />
                Pre-event
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-4 bg-teal" />
                Post-crush
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-4 border-t-2 border-dashed border-ink/70" />
                Spot
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-4 bg-graphite/40" />
                Strike
              </span>
              {mode === "expiration" ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-px w-4 bg-teal" />
                  Breakeven
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div
        key={chartKey}
        className="animate-draw-in h-[300px] w-full min-w-0 px-1 pt-3 pb-1 sm:h-[360px] sm:px-2"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              stroke={gridStroke}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="underlying"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => formatPrice(Number(v), 0)}
              tick={{ fill: tickFill, fontSize: 11 }}
              axisLine={{ stroke: axisStroke }}
              tickLine={false}
            />
            <YAxis
              domain={[yMin - pad, yMax + pad]}
              tickFormatter={(v) =>
                formatMoney(Number(v), { compact: true, signed: true })
              }
              tick={{ fill: tickFill, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              content={
                <ChartTooltip mode={mode} eventLabel={vol.eventLabel} />
              }
            />
            {mode === "ivCrush" ? (
              <Legend
                verticalAlign="top"
                height={28}
                formatter={(value) =>
                  value === "prePnl" ? "Pre-event" : "Post-crush"
                }
              />
            ) : null}
            <ReferenceLine y={0} stroke={zeroStroke} strokeWidth={1} />
            <ReferenceLine
              x={spot}
              stroke={inkStroke}
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
            {strikes.map((k) => (
              <ReferenceLine
                key={`k-${k}`}
                x={k}
                stroke={strikeStroke}
                strokeWidth={1}
              />
            ))}
            {mode === "expiration"
              ? metrics.breakevens.map((be) => (
                  <ReferenceLine
                    key={`be-${be}`}
                    x={be}
                    stroke={tealStroke}
                    strokeWidth={1.5}
                  />
                ))
              : null}
            {mode === "ivCrush" ? (
              <>
                <Line
                  type="monotone"
                  dataKey="prePnl"
                  name="prePnl"
                  stroke={inkStroke}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="postPnl"
                  name="postPnl"
                  stroke={tealStroke}
                  strokeWidth={2.25}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="none"
                  fill={
                    dark ? "rgba(43,184,168,0.16)" : "rgba(15,118,110,0.12)"
                  }
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="loss"
                  stroke="none"
                  fill={
                    dark ? "rgba(240,113,103,0.14)" : "rgba(180,35,24,0.10)"
                  }
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke={tealStroke}
                  strokeWidth={2.25}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-border/70 px-4 py-3 sm:px-5">
        <button
          type="button"
          className="text-xs font-medium text-teal underline-offset-2 hover:underline"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
        >
          {showTable ? "Hide" : "Show"} numeric summary
        </button>
        {showTable ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-1.5 font-semibold">Point</th>
                  <th className="py-1.5 font-semibold">S</th>
                  {mode === "ivCrush" ? (
                    <>
                      <th className="py-1.5 font-semibold">Pre</th>
                      <th className="py-1.5 font-semibold">Post</th>
                    </>
                  ) : (
                    <th className="py-1.5 font-semibold">P&L</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {mode === "ivCrush"
                  ? (
                      tableRows as Array<{
                        label: string;
                        x: number;
                        pre: number;
                        post: number;
                      }>
                    ).map((row) => (
                      <tr
                        key={`${row.label}-${row.x}`}
                        className="border-b border-border/60"
                      >
                        <td className="py-1.5 text-muted-foreground">
                          {row.label}
                        </td>
                        <td className="font-tabular py-1.5">
                          {formatPrice(row.x)}
                        </td>
                        <td className="font-tabular py-1.5">
                          {formatMoney(row.pre, { signed: true })}
                        </td>
                        <td className="font-tabular py-1.5 font-medium text-teal">
                          {formatMoney(row.post, { signed: true })}
                        </td>
                      </tr>
                    ))
                  : (
                      tableRows as Array<{
                        label: string;
                        x: number;
                        pnl: number;
                      }>
                    ).map((row) => (
                      <tr
                        key={`${row.label}-${row.x}`}
                        className="border-b border-border/60"
                      >
                        <td className="py-1.5 text-muted-foreground">
                          {row.label}
                        </td>
                        <td className="font-tabular py-1.5">
                          {formatPrice(row.x)}
                        </td>
                        <td
                          className={`font-tabular py-1.5 font-medium ${
                            row.pnl > 0
                              ? "text-profit"
                              : row.pnl < 0
                                ? "text-loss"
                                : ""
                          }`}
                        >
                          {formatMoney(row.pnl, { signed: true })}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
