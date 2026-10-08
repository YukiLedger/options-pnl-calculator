import { sideSign } from "./payoff";
import type { OptionLeg, OptionType } from "./types";

/** Standard normal PDF */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Standard normal CDF (Abramowitz & Stegun 26.2.17) */
export function normCdf(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export interface BsInputs {
  spot: number;
  strike: number;
  timeYears: number;
  rate: number;
  dividendYield: number;
  volatility: number;
  type: OptionType;
}

export interface BsResult {
  price: number;
  delta: number;
  /** Vega per 1.00 absolute vol (e.g. 0→1). Divide by 100 for per-vol-point. */
  vega: number;
  d1: number;
  d2: number;
}

function clampVol(vol: number): number {
  if (!Number.isFinite(vol) || vol < 0) return NaN;
  return Math.max(vol, 1e-12);
}

/**
 * European Black–Scholes–Merton with continuous dividend yield.
 * At T ≤ 0, returns intrinsic (delta 0/1/−1, vega 0).
 */
export function blackScholes(inputs: BsInputs): BsResult {
  const { spot, strike, timeYears, rate, dividendYield, type } = inputs;
  const vol = clampVol(inputs.volatility);

  if (
    !(spot > 0) ||
    !(strike > 0) ||
    !Number.isFinite(rate) ||
    !Number.isFinite(dividendYield) ||
    Number.isNaN(vol)
  ) {
    return { price: NaN, delta: NaN, vega: NaN, d1: NaN, d2: NaN };
  }

  if (!(timeYears > 0) || vol < 1e-10) {
    const intrinsic =
      type === "call" ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
    const delta =
      type === "call" ? (spot > strike ? 1 : spot === strike ? 0.5 : 0) : spot < strike ? -1 : spot === strike ? -0.5 : 0;
    return { price: intrinsic, delta, vega: 0, d1: NaN, d2: NaN };
  }

  const sqrtT = Math.sqrt(timeYears);
  const d1 =
    (Math.log(spot / strike) +
      (rate - dividendYield + 0.5 * vol * vol) * timeYears) /
    (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const discQ = Math.exp(-dividendYield * timeYears);
  const discR = Math.exp(-rate * timeYears);
  const pdf = normPdf(d1);
  const vega = spot * discQ * pdf * sqrtT;

  if (type === "call") {
    const price = spot * discQ * normCdf(d1) - strike * discR * normCdf(d2);
    const delta = discQ * normCdf(d1);
    return { price, delta, vega, d1, d2 };
  }

  const price = strike * discR * normCdf(-d2) - spot * discQ * normCdf(-d1);
  const delta = -discQ * normCdf(-d1);
  return { price, delta, vega, d1, d2 };
}

export function daysToYears(days: number): number {
  return days / 365;
}

/** Theoretical value of one leg (currency, includes qty × multiplier). */
export function legTheoValue(
  leg: OptionLeg,
  spot: number,
  volatility: number,
  timeYears: number,
  rate: number,
  dividendYield: number,
): number {
  const { price } = blackScholes({
    spot,
    strike: leg.strike,
    timeYears,
    rate,
    dividendYield,
    volatility,
    type: leg.type,
  });
  if (!Number.isFinite(price)) return NaN;
  return price * leg.quantity * leg.multiplier;
}

/**
 * Mark-to-model P&L vs entry premium for one leg.
 * sideSign × (theo − premium) × qty × multiplier
 */
export function legMarkPnl(
  leg: OptionLeg,
  spot: number,
  volatility: number,
  timeYears: number,
  rate: number,
  dividendYield: number,
): number {
  const { price } = blackScholes({
    spot,
    strike: leg.strike,
    timeYears,
    rate,
    dividendYield,
    volatility,
    type: leg.type,
  });
  if (!Number.isFinite(price)) return NaN;
  return sideSign(leg.side) * (price - leg.premium) * leg.quantity * leg.multiplier;
}

/** Book mark-to-model P&L vs entry premiums. */
export function bookMarkPnl(
  legs: OptionLeg[],
  spot: number,
  volatility: number,
  timeYears: number,
  rate: number,
  dividendYield: number,
): number {
  return legs.reduce(
    (sum, leg) =>
      sum + legMarkPnl(leg, spot, volatility, timeYears, rate, dividendYield),
    0,
  );
}

/** Signed book vega in currency per 1.00 vol (divide by 100 for per vol-point). */
export function bookVega(
  legs: OptionLeg[],
  spot: number,
  volatility: number,
  timeYears: number,
  rate: number,
  dividendYield: number,
): number {
  return legs.reduce((sum, leg) => {
    const { vega } = blackScholes({
      spot,
      strike: leg.strike,
      timeYears,
      rate,
      dividendYield,
      volatility,
      type: leg.type,
    });
    if (!Number.isFinite(vega)) return sum;
    return sum + sideSign(leg.side) * vega * leg.quantity * leg.multiplier;
  }, 0);
}
