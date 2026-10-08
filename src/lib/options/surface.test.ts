import { describe, expect, it } from "vitest";
import { buildMarkSurface, nearestIndex, pnlToRgb } from "./surface";
import type { OptionLeg, VolParams } from "./types";
import { DEFAULT_VOL_PARAMS } from "./types";

const shortStraddle: OptionLeg[] = [
  {
    id: "c",
    side: "short",
    type: "call",
    strike: 100,
    premium: 4,
    quantity: 1,
    multiplier: 100,
  },
  {
    id: "p",
    side: "short",
    type: "put",
    strike: 100,
    premium: 4,
    quantity: 1,
    multiplier: 100,
  },
];

const vol: VolParams = { ...DEFAULT_VOL_PARAMS, iv: 0.45, crushPct: 0.4 };

describe("buildMarkSurface", () => {
  it("returns null for empty book or invalid IV", () => {
    expect(buildMarkSurface([], 100, vol)).toBeNull();
    expect(
      buildMarkSurface(shortStraddle, 100, { ...vol, iv: 0 }),
    ).toBeNull();
  });

  it("builds a rectangular spot × IV grid", () => {
    const grid = buildMarkSurface(shortStraddle, 100, vol, {
      nSpot: 12,
      nIv: 10,
    });
    expect(grid).not.toBeNull();
    expect(grid!.spots).toHaveLength(12);
    expect(grid!.ivs).toHaveLength(10);
    expect(grid!.pnl).toHaveLength(10);
    expect(grid!.pnl[0]).toHaveLength(12);
    expect(grid!.preIv).toBeCloseTo(0.45, 6);
    expect(grid!.postIv).toBeCloseTo(0.27, 6);
  });

  it("short straddle mark P&L rises as IV falls near ATM", () => {
    const grid = buildMarkSurface(shortStraddle, 100, vol, {
      nSpot: 21,
      nIv: 21,
    })!;
    const spotIdx = nearestIndex(grid.spots, 100);
    const highIvIdx = nearestIndex(grid.ivs, grid.preIv);
    const lowIvIdx = nearestIndex(grid.ivs, grid.postIv);
    expect(grid.pnl[lowIvIdx]![spotIdx]!).toBeGreaterThan(
      grid.pnl[highIvIdx]![spotIdx]!,
    );
  });
});

describe("pnlToRgb", () => {
  it("maps profit toward teal and loss toward crimson", () => {
    const profit = pnlToRgb(500, -500, 500);
    const loss = pnlToRgb(-500, -500, 500);
    expect(profit[1]).toBeGreaterThan(profit[0]); // greener
    expect(loss[0]).toBeGreaterThan(loss[1]); // redder
  });
});
