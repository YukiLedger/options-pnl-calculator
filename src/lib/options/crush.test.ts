import { describe, expect, it } from "vitest";
import {
  computeCrushStress,
  postCrushIv,
  sampleCrushCurves,
  validateVolParams,
} from "./crush";
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

const vol: VolParams = {
  ...DEFAULT_VOL_PARAMS,
  iv: 0.5,
  daysToExpiry: 21,
  crushPct: 0.4,
  eventLabel: "Earnings",
};

describe("postCrushIv", () => {
  it("applies crush as a fraction of pre-event IV", () => {
    expect(postCrushIv(0.5, 0.4)).toBeCloseTo(0.3, 8);
    expect(postCrushIv(0.4, 0)).toBeCloseTo(0.4, 8);
    expect(postCrushIv(0.4, 1)).toBeCloseTo(0, 8);
  });
});

describe("validateVolParams", () => {
  it("flags invalid IV and crush", () => {
    expect(validateVolParams({ ...vol, iv: 0 }).length).toBeGreaterThan(0);
    expect(validateVolParams({ ...vol, crushPct: 1.2 }).length).toBeGreaterThan(
      0,
    );
    expect(validateVolParams({ ...vol, daysToExpiry: 0 }).length).toBeGreaterThan(
      0,
    );
    expect(validateVolParams(vol)).toEqual([]);
  });
});

describe("computeCrushStress", () => {
  it("short straddle benefits from IV crush at unchanged spot", () => {
    const result = computeCrushStress(shortStraddle, 100, vol);
    expect(result.ok).toBe(true);
    expect(result.postIv).toBeCloseTo(0.3, 8);
    expect(result.crushPnl).toBeGreaterThan(0);
    expect(result.shortVega).toBe(true);
    expect(result.canLoseIfUnderlyingFavorable).toBe(false);
    expect(result.postPnl).toBeGreaterThan(result.prePnl);
  });

  it("long straddle is hurt by IV crush (can lose even if spot unchanged)", () => {
    const long = shortStraddle.map((l) => ({ ...l, side: "long" as const }));
    const result = computeCrushStress(long, 100, vol);
    expect(result.ok).toBe(true);
    expect(result.crushPnl).toBeLessThan(0);
    expect(result.shortVega).toBe(false);
    expect(result.canLoseIfUnderlyingFavorable).toBe(true);
  });

  it("returns errors for empty book / bad IV", () => {
    expect(computeCrushStress([], 100, vol).ok).toBe(false);
    expect(computeCrushStress(shortStraddle, 100, { ...vol, iv: -0.1 }).ok).toBe(
      false,
    );
  });
});

describe("sampleCrushCurves", () => {
  it("returns dual curves with post > pre for short straddle near ATM", () => {
    const { merged } = sampleCrushCurves(shortStraddle, 100, vol, {
      points: 21,
    });
    expect(merged.length).toBeGreaterThan(5);
    const atm = merged.find((p) => Math.abs(p.underlying - 100) < 1e-9);
    expect(atm).toBeDefined();
    expect(atm!.postPnl).toBeGreaterThan(atm!.prePnl);
  });
});
