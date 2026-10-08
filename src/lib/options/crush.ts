import {
  blackScholes,
  bookMarkPnl,
  bookVega,
  daysToYears,
} from "./black-scholes";
import { sampleRange } from "./payoff";
import type {
  CrushStressResult,
  OptionLeg,
  PayoffPoint,
  VolParams,
} from "./types";

export function postCrushIv(preIv: number, crushPct: number): number {
  if (!Number.isFinite(preIv) || !Number.isFinite(crushPct)) return NaN;
  return Math.max(0, preIv * (1 - crushPct));
}

export function validateVolParams(vol: VolParams): string[] {
  const errors: string[] = [];
  if (!(vol.iv > 0) || !Number.isFinite(vol.iv)) {
    errors.push("Implied vol must be greater than 0%.");
  }
  if (vol.iv > 3) {
    errors.push("Implied vol looks extreme (>300%). Check the input.");
  }
  if (!(vol.daysToExpiry > 0) || !Number.isFinite(vol.daysToExpiry)) {
    errors.push("Days to expiry must be greater than zero for mark-to-model.");
  }
  if (!Number.isFinite(vol.crushPct) || vol.crushPct < 0 || vol.crushPct > 1) {
    errors.push("Crush magnitude must be between 0% and 100%.");
  }
  if (!Number.isFinite(vol.rate)) {
    errors.push("Rate must be a finite number.");
  }
  if (!Number.isFinite(vol.dividendYield)) {
    errors.push("Dividend yield must be a finite number.");
  }
  return errors;
}

export function sampleMarkCurve(
  legs: OptionLeg[],
  spot: number,
  volatility: number,
  vol: VolParams,
  options?: { points?: number; pad?: number },
): PayoffPoint[] {
  const points = options?.points ?? 161;
  const { min, max } = sampleRange(legs, spot, options?.pad ?? 0.28);
  const T = daysToYears(vol.daysToExpiry);
  const xs = new Set<number>();
  if (points <= 1) {
    xs.add(min);
  } else {
    for (let i = 0; i < points; i++) {
      xs.add(min + ((max - min) * i) / (points - 1));
    }
  }
  xs.add(spot);
  for (const leg of legs) {
    if (Number.isFinite(leg.strike)) xs.add(leg.strike);
  }

  return [...xs]
    .filter((x) => Number.isFinite(x) && x >= 0)
    .sort((a, b) => a - b)
    .map((underlying) => ({
      underlying,
      pnl: bookMarkPnl(
        legs,
        underlying,
        volatility,
        T,
        vol.rate,
        vol.dividendYield,
      ),
    }));
}

export interface DualCrushCurves {
  pre: PayoffPoint[];
  post: PayoffPoint[];
  /** Merged rows for charting: underlying, prePnl, postPnl */
  merged: Array<{ underlying: number; prePnl: number; postPnl: number }>;
}

export function sampleCrushCurves(
  legs: OptionLeg[],
  spot: number,
  vol: VolParams,
  options?: { points?: number; pad?: number },
): DualCrushCurves {
  const preIv = vol.iv;
  const postIv = postCrushIv(vol.iv, vol.crushPct);
  const pre = sampleMarkCurve(legs, spot, preIv, vol, options);
  const post = sampleMarkCurve(legs, spot, postIv, vol, options);

  const xs = new Set<number>([
    ...pre.map((p) => p.underlying),
    ...post.map((p) => p.underlying),
  ]);
  const T = daysToYears(vol.daysToExpiry);
  const merged = [...xs]
    .sort((a, b) => a - b)
    .map((underlying) => ({
      underlying,
      prePnl: bookMarkPnl(
        legs,
        underlying,
        preIv,
        T,
        vol.rate,
        vol.dividendYield,
      ),
      postPnl: bookMarkPnl(
        legs,
        underlying,
        postIv,
        T,
        vol.rate,
        vol.dividendYield,
      ),
    }));

  return { pre, post, merged };
}

/**
 * IV crush stress at a fixed underlying (typically reference spot).
 * Answers: if S is unchanged and IV drops by crush%, what happens to mark P&L?
 */
export function computeCrushStress(
  legs: OptionLeg[],
  spot: number,
  vol: VolParams,
): CrushStressResult {
  const errors = validateVolParams(vol);
  if (legs.length === 0) {
    return {
      ok: false,
      errors: ["Add legs to run an IV crush stress."],
      preIv: vol.iv,
      postIv: postCrushIv(vol.iv, vol.crushPct),
      prePnl: 0,
      postPnl: 0,
      crushPnl: 0,
      vegaPerVolPoint: 0,
      shortVega: false,
      canLoseIfUnderlyingFavorable: false,
    };
  }
  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      preIv: vol.iv,
      postIv: postCrushIv(vol.iv, vol.crushPct),
      prePnl: NaN,
      postPnl: NaN,
      crushPnl: NaN,
      vegaPerVolPoint: NaN,
      shortVega: false,
      canLoseIfUnderlyingFavorable: false,
    };
  }

  const T = daysToYears(vol.daysToExpiry);
  const preIv = vol.iv;
  const postIv = postCrushIv(vol.iv, vol.crushPct);
  const prePnl = bookMarkPnl(
    legs,
    spot,
    preIv,
    T,
    vol.rate,
    vol.dividendYield,
  );
  const postPnl = bookMarkPnl(
    legs,
    spot,
    postIv,
    T,
    vol.rate,
    vol.dividendYield,
  );
  const crushPnl = postPnl - prePnl;
  const vega = bookVega(legs, spot, preIv, T, vol.rate, vol.dividendYield);
  const vegaPerVolPoint = vega / 100;
  const shortVega = vega < -1e-6;

  // Classic earnings callout for long premium: IV crush can erase P&L
  // even when the underlying moves in a "favorable" direction.
  const canLoseIfUnderlyingFavorable = !shortVega && crushPnl < -1e-6;

  return {
    ok: true,
    errors: [],
    preIv,
    postIv,
    prePnl,
    postPnl,
    crushPnl,
    vegaPerVolPoint,
    shortVega,
    canLoseIfUnderlyingFavorable,
  };
}

/** Sanity helper used in tests: ATM approx price check via BS. */
export function atmCallPrice(
  spot: number,
  vol: number,
  days: number,
  rate = 0,
  q = 0,
): number {
  return blackScholes({
    spot,
    strike: spot,
    timeYears: daysToYears(days),
    rate,
    dividendYield: q,
    volatility: vol,
    type: "call",
  }).price;
}
