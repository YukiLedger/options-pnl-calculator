import { bookMarkPnl, daysToYears } from "./black-scholes";
import { postCrushIv } from "./crush";
import { sampleRange } from "./payoff";
import type { OptionLeg, VolParams } from "./types";

export interface SurfaceGrid {
  /** Spot axis (length = nSpot) */
  spots: number[];
  /** IV axis as decimals (length = nIv) */
  ivs: number[];
  /** Row-major z[ivIndex][spotIndex] = mark P&L */
  pnl: number[][];
  minPnl: number;
  maxPnl: number;
  preIv: number;
  postIv: number;
  spot: number;
}

export function buildMarkSurface(
  legs: OptionLeg[],
  spot: number,
  vol: VolParams,
  options?: { nSpot?: number; nIv?: number; pad?: number },
): SurfaceGrid | null {
  if (legs.length === 0) return null;
  if (!(vol.iv > 0) || !(vol.daysToExpiry > 0)) return null;

  const nSpot = options?.nSpot ?? 36;
  const nIv = options?.nIv ?? 28;
  const { min, max } = sampleRange(legs, spot, options?.pad ?? 0.3);
  const T = daysToYears(vol.daysToExpiry);

  const preIv = vol.iv;
  const postIv = postCrushIv(vol.iv, vol.crushPct);
  const ivLo = Math.max(0.02, Math.min(preIv, postIv) * 0.45);
  const ivHi = Math.max(preIv, postIv) * 1.55 + 0.05;

  const spots: number[] = [];
  for (let i = 0; i < nSpot; i++) {
    spots.push(min + ((max - min) * i) / Math.max(nSpot - 1, 1));
  }

  const ivs: number[] = [];
  for (let j = 0; j < nIv; j++) {
    ivs.push(ivLo + ((ivHi - ivLo) * j) / Math.max(nIv - 1, 1));
  }
  // Ensure pre/post IV sample rows exist (snap nearest later for markers)
  ivs.sort((a, b) => a - b);

  const pnl: number[][] = [];
  let minPnl = Infinity;
  let maxPnl = -Infinity;

  for (let j = 0; j < ivs.length; j++) {
    const row: number[] = [];
    const iv = ivs[j]!;
    for (let i = 0; i < spots.length; i++) {
      const z = bookMarkPnl(
        legs,
        spots[i]!,
        iv,
        T,
        vol.rate,
        vol.dividendYield,
      );
      const value = Number.isFinite(z) ? z : 0;
      row.push(value);
      if (value < minPnl) minPnl = value;
      if (value > maxPnl) maxPnl = value;
    }
    pnl.push(row);
  }

  if (!Number.isFinite(minPnl) || !Number.isFinite(maxPnl)) {
    minPnl = -1;
    maxPnl = 1;
  }
  if (minPnl === maxPnl) {
    minPnl -= 1;
    maxPnl += 1;
  }

  return { spots, ivs, pnl, minPnl, maxPnl, preIv, postIv, spot };
}

/** Map a scalar P&L into a teal→graphite→crimson RGB triple (0–1). */
export function pnlToRgb(
  value: number,
  minPnl: number,
  maxPnl: number,
): [number, number, number] {
  const mid = 0;
  if (value >= mid) {
    const t = Math.min(1, value / Math.max(maxPnl, 1e-9));
    // graphite → teal
    return [
      0.08 + (0.06 - 0.08) * t,
      0.18 + (0.46 - 0.18) * t,
      0.24 + (0.43 - 0.24) * t,
    ];
  }
  const t = Math.min(1, Math.abs(value) / Math.max(Math.abs(minPnl), 1e-9));
  // graphite → crimson
  return [
    0.08 + (0.71 - 0.08) * t,
    0.18 + (0.14 - 0.18) * t,
    0.24 + (0.09 - 0.24) * t,
  ];
}

export function nearestIndex(values: number[], target: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i]! - target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
