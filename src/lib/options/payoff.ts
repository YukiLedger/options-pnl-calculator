import type { OptionLeg, OptionSide, OptionType, PayoffPoint } from "./types";

/** +1 long, −1 short */
export function sideSign(side: OptionSide): 1 | -1 {
  return side === "long" ? 1 : -1;
}

export function intrinsicValue(
  type: OptionType,
  strike: number,
  underlying: number,
): number {
  if (type === "call") {
    return Math.max(underlying - strike, 0);
  }
  return Math.max(strike - underlying, 0);
}

/**
 * Terminal (expiration) P&L for a single leg.
 * leg P&L = sideSign × (intrinsic − premium) × qty × multiplier
 */
export function legPayoffAt(leg: OptionLeg, underlying: number): number {
  const intrinsic = intrinsicValue(leg.type, leg.strike, underlying);
  return (
    sideSign(leg.side) *
    (intrinsic - leg.premium) *
    leg.quantity *
    leg.multiplier
  );
}

export function bookPayoffAt(legs: OptionLeg[], underlying: number): number {
  return legs.reduce((sum, leg) => sum + legPayoffAt(leg, underlying), 0);
}

/**
 * Cash at open from the trader's perspective:
 * long premium is cash out (negative), short premium is cash in (positive).
 * netCashAtOpen = Σ (−sideSign × premium × qty × multiplier)
 */
export function netCashAtOpen(legs: OptionLeg[]): number {
  return legs.reduce(
    (sum, leg) =>
      sum + -sideSign(leg.side) * leg.premium * leg.quantity * leg.multiplier,
    0,
  );
}

/** Net premium paid (positive debit) / received (negative = credit). Alias of −netCashAtOpen. */
export function netPremiumPaid(legs: OptionLeg[]): number {
  return -netCashAtOpen(legs);
}

export function sampleRange(
  legs: OptionLeg[],
  spot: number,
  pad = 0.25,
): { min: number; max: number } {
  const strikes = legs.map((l) => l.strike).filter((k) => Number.isFinite(k) && k > 0);
  const anchors = [...strikes, spot].filter((v) => Number.isFinite(v) && v > 0);
  if (anchors.length === 0) {
    return { min: 0, max: 100 };
  }
  const lo = Math.min(...anchors);
  const hi = Math.max(...anchors);
  const span = Math.max(hi - lo, hi * 0.1, 1);
  const padAmt = Math.max(span * pad, hi * 0.15, 5);
  return {
    min: Math.max(0, lo - padAmt),
    max: hi + padAmt,
  };
}

export function samplePayoffCurve(
  legs: OptionLeg[],
  spot: number,
  options?: { points?: number; pad?: number },
): PayoffPoint[] {
  const points = options?.points ?? 201;
  const { min, max } = sampleRange(legs, spot, options?.pad ?? 0.25);
  const strikes = [
    ...new Set(
      legs
        .map((l) => l.strike)
        .filter((k) => Number.isFinite(k) && k >= min && k <= max),
    ),
  ].sort((a, b) => a - b);

  const xs = new Set<number>();
  if (points <= 1) {
    xs.add(min);
  } else {
    for (let i = 0; i < points; i++) {
      xs.add(min + ((max - min) * i) / (points - 1));
    }
  }
  xs.add(spot);
  for (const k of strikes) xs.add(k);
  // Extra wing samples for asymptote classification
  xs.add(Math.max(0, min * 0.5));
  xs.add(max * 1.5);

  return [...xs]
    .filter((x) => Number.isFinite(x) && x >= 0)
    .sort((a, b) => a - b)
    .map((underlying) => ({
      underlying,
      pnl: bookPayoffAt(legs, underlying),
    }));
}
