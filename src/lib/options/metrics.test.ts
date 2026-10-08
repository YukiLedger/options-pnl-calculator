import { describe, expect, it } from "vitest";
import { computeRiskMetrics, findBreakevens } from "./metrics";
import type { OptionLeg } from "./types";

describe("computeRiskMetrics", () => {
  it("long call: max loss = premium, unlimited profit, BE = K+prem", () => {
    const legs: OptionLeg[] = [
      {
        id: "1",
        side: "long",
        type: "call",
        strike: 100,
        premium: 5,
        quantity: 1,
        multiplier: 100,
      },
    ];
    const m = computeRiskMetrics(legs, 100);
    expect(m.maxLoss).toEqual({ kind: "finite", value: -500 });
    expect(m.maxProfit.kind).toBe("unlimited");
    expect(m.breakevens[0]).toBeCloseTo(105, 1);
    expect(m.pnlAtSpot).toBeCloseTo(-500, 6);
    expect(m.netPremium).toBeCloseTo(500, 6);
  });

  it("short naked call: unlimited loss, max profit = credit", () => {
    const legs: OptionLeg[] = [
      {
        id: "1",
        side: "short",
        type: "call",
        strike: 100,
        premium: 5,
        quantity: 1,
        multiplier: 100,
      },
    ];
    const m = computeRiskMetrics(legs, 100);
    expect(m.maxLoss.kind).toBe("unlimited");
    expect(m.maxProfit).toEqual({ kind: "finite", value: 500 });
  });

  it("bull call vertical: max profit = width − net debit", () => {
    const legs: OptionLeg[] = [
      {
        id: "long",
        side: "long",
        type: "call",
        strike: 100,
        premium: 6,
        quantity: 1,
        multiplier: 100,
      },
      {
        id: "short",
        side: "short",
        type: "call",
        strike: 110,
        premium: 2,
        quantity: 1,
        multiplier: 100,
      },
    ];
    const m = computeRiskMetrics(legs, 105);
    expect(m.maxProfit).toEqual({ kind: "finite", value: 600 });
    expect(m.maxLoss).toEqual({ kind: "finite", value: -400 });
    expect(m.breakevens.length).toBeGreaterThanOrEqual(1);
    expect(m.breakevens[0]).toBeCloseTo(104, 0);
  });

  it("iron condor: defined max profit (credit) and max loss", () => {
    const legs: OptionLeg[] = [
      {
        id: "1",
        side: "long",
        type: "put",
        strike: 90,
        premium: 1,
        quantity: 1,
        multiplier: 100,
      },
      {
        id: "2",
        side: "short",
        type: "put",
        strike: 95,
        premium: 2.5,
        quantity: 1,
        multiplier: 100,
      },
      {
        id: "3",
        side: "short",
        type: "call",
        strike: 105,
        premium: 2.5,
        quantity: 1,
        multiplier: 100,
      },
      {
        id: "4",
        side: "long",
        type: "call",
        strike: 110,
        premium: 1,
        quantity: 1,
        multiplier: 100,
      },
    ];
    const m = computeRiskMetrics(legs, 100);
    expect(m.maxProfit).toEqual({ kind: "finite", value: 300 });
    expect(m.maxLoss).toEqual({ kind: "finite", value: -200 });
    expect(m.breakevens.length).toBe(2);
  });
});

describe("findBreakevens", () => {
  it("returns empty for empty book", () => {
    expect(findBreakevens([], 100)).toEqual([]);
  });
});
