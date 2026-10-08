import { bookPayoffAt, netCashAtOpen, netPremiumPaid, samplePayoffCurve } from "./payoff";
import type { BoundMetric, OptionLeg, RiskMetrics } from "./types";

const WING_EPS = 1e-6;
const UNLIMITED_THRESHOLD = 1e9;

function classifyBound(
  values: number[],
  mode: "max" | "min",
): BoundMetric {
  if (values.length === 0) {
    return { kind: "finite", value: 0 };
  }
  const extreme = mode === "max" ? Math.max(...values) : Math.min(...values);
  if (!Number.isFinite(extreme) || Math.abs(extreme) >= UNLIMITED_THRESHOLD) {
    return {
      kind: "unlimited",
      direction: mode === "max" ? "profit" : "loss",
    };
  }
  return { kind: "finite", value: extreme };
}

/**
 * Detect whether left/right wings diverge to ±∞ by comparing far samples
 * against the outermost strike neighborhood.
 */
function wingAsymptotes(legs: OptionLeg[], spot: number): {
  left: "up" | "down" | "flat";
  right: "up" | "down" | "flat";
  criticalPnls: number[];
} {
  if (legs.length === 0) {
    return { left: "flat", right: "flat", criticalPnls: [0] };
  }

  const strikes = legs
    .map((l) => l.strike)
    .filter((k) => Number.isFinite(k) && k > 0)
    .sort((a, b) => a - b);
  const minK = strikes[0] ?? spot;
  const maxK = strikes[strikes.length - 1] ?? spot;

  const farLeft = Math.max(0, minK * 0.01);
  const nearLeft = Math.max(0, minK * 0.5);
  const nearRight = maxK * 1.5;
  const farRight = maxK * 5;

  const pnlFarLeft = bookPayoffAt(legs, farLeft);
  const pnlNearLeft = bookPayoffAt(legs, nearLeft);
  const pnlNearRight = bookPayoffAt(legs, nearRight);
  const pnlFarRight = bookPayoffAt(legs, farRight);

  const leftDelta = pnlFarLeft - pnlNearLeft;
  const rightDelta = pnlFarRight - pnlNearRight;

  const left: "up" | "down" | "flat" =
    Math.abs(leftDelta) < WING_EPS ? "flat" : leftDelta > 0 ? "up" : "down";
  const right: "up" | "down" | "flat" =
    Math.abs(rightDelta) < WING_EPS ? "flat" : rightDelta > 0 ? "up" : "down";

  // Critical points: all strikes + midpoints between adjacent strikes + spot
  const criticalXs = new Set<number>([spot, 0, ...strikes]);
  for (let i = 0; i < strikes.length - 1; i++) {
    criticalXs.add((strikes[i]! + strikes[i + 1]!) / 2);
  }
  // Slightly inside/outside outermost strikes
  criticalXs.add(Math.max(0, minK - 1e-6));
  criticalXs.add(maxK + 1e-6);

  const criticalPnls = [...criticalXs].map((x) => bookPayoffAt(legs, x));

  // Include finite wing samples when flat/bounded
  if (left === "flat") criticalPnls.push(pnlFarLeft, pnlNearLeft);
  if (right === "flat") criticalPnls.push(pnlFarRight, pnlNearRight);

  return { left, right, criticalPnls };
}

export function findBreakevens(
  legs: OptionLeg[],
  spot: number,
  tolerance = 1e-6,
): number[] {
  if (legs.length === 0) return [];

  const curve = samplePayoffCurve(legs, spot, { points: 401, pad: 0.35 });
  // Ensure dense coverage around strikes
  const strikes = legs.map((l) => l.strike);
  const extras = strikes.flatMap((k) => [k * 0.99, k, k * 1.01]);
  const points = [
    ...curve,
    ...extras.map((underlying) => ({
      underlying,
      pnl: bookPayoffAt(legs, underlying),
    })),
  ].sort((a, b) => a.underlying - b.underlying);

  const roots: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (Math.abs(a.pnl) <= tolerance) {
      roots.push(a.underlying);
      continue;
    }
    if (a.pnl === 0 || b.pnl === 0) {
      if (b.pnl === 0) roots.push(b.underlying);
      continue;
    }
    if (a.pnl * b.pnl < 0) {
      // Linear interpolation root
      const t = a.pnl / (a.pnl - b.pnl);
      const root = a.underlying + t * (b.underlying - a.underlying);
      roots.push(root);
    }
  }

  // Deduplicate nearby roots
  roots.sort((x, y) => x - y);
  const unique: number[] = [];
  for (const r of roots) {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.abs(r - last) > 0.01) {
      unique.push(Number(r.toFixed(4)));
    }
  }
  return unique;
}

export function computeRiskMetrics(
  legs: OptionLeg[],
  spot: number,
): RiskMetrics {
  if (legs.length === 0) {
    return {
      netPremium: 0,
      netCashAtOpen: 0,
      pnlAtSpot: 0,
      maxProfit: { kind: "finite", value: 0 },
      maxLoss: { kind: "finite", value: 0 },
      breakevens: [],
    };
  }

  const { left, right, criticalPnls } = wingAsymptotes(legs, spot);

  let maxProfit: BoundMetric;
  let maxLoss: BoundMetric;

  if (left === "up" || right === "up") {
    maxProfit = { kind: "unlimited", direction: "profit" };
  } else {
    maxProfit = classifyBound(criticalPnls, "max");
  }

  if (left === "down" || right === "down") {
    maxLoss = { kind: "unlimited", direction: "loss" };
  } else {
    maxLoss = classifyBound(criticalPnls, "min");
  }

  return {
    netPremium: netPremiumPaid(legs),
    netCashAtOpen: netCashAtOpen(legs),
    pnlAtSpot: bookPayoffAt(legs, spot),
    maxProfit,
    maxLoss,
    breakevens: findBreakevens(legs, spot),
  };
}
