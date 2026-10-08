import { describe, expect, it } from "vitest";
import {
  bookPayoffAt,
  intrinsicValue,
  legPayoffAt,
  netCashAtOpen,
  netPremiumPaid,
} from "./payoff";
import type { OptionLeg } from "./types";

const call100: OptionLeg = {
  id: "1",
  side: "long",
  type: "call",
  strike: 100,
  premium: 5,
  quantity: 1,
  multiplier: 100,
};

describe("intrinsicValue", () => {
  it("computes call and put intrinsic", () => {
    expect(intrinsicValue("call", 100, 110)).toBe(10);
    expect(intrinsicValue("call", 100, 90)).toBe(0);
    expect(intrinsicValue("put", 100, 90)).toBe(10);
    expect(intrinsicValue("put", 100, 110)).toBe(0);
  });
});

describe("legPayoffAt", () => {
  it("long call: breakeven at K + premium", () => {
    expect(legPayoffAt(call100, 105)).toBeCloseTo(0, 6);
    expect(legPayoffAt(call100, 100)).toBeCloseTo(-500, 6);
    expect(legPayoffAt(call100, 120)).toBeCloseTo(1500, 6);
  });

  it("short call negates long call P&L", () => {
    const short = { ...call100, side: "short" as const };
    expect(legPayoffAt(short, 120)).toBeCloseTo(-legPayoffAt(call100, 120), 6);
    expect(legPayoffAt(short, 90)).toBeCloseTo(-legPayoffAt(call100, 90), 6);
  });

  it("doubling quantity doubles P&L", () => {
    const doubled = { ...call100, quantity: 2 };
    expect(legPayoffAt(doubled, 120)).toBeCloseTo(
      2 * legPayoffAt(call100, 120),
      6,
    );
  });

  it("long put breakeven at K − premium", () => {
    const put: OptionLeg = {
      id: "p",
      side: "long",
      type: "put",
      strike: 100,
      premium: 4,
      quantity: 1,
      multiplier: 100,
    };
    expect(legPayoffAt(put, 96)).toBeCloseTo(0, 6);
    expect(legPayoffAt(put, 100)).toBeCloseTo(-400, 6);
  });
});

describe("bookPayoffAt & premium", () => {
  it("aggregates multi-leg bull call vertical", () => {
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
    // Net debit = 4 per share → 400
    expect(netPremiumPaid(legs)).toBeCloseTo(400, 6);
    expect(netCashAtOpen(legs)).toBeCloseTo(-400, 6);
    // Max profit at/above 110: width 10 − debit 4 = 6 → 600
    expect(bookPayoffAt(legs, 110)).toBeCloseTo(600, 6);
    expect(bookPayoffAt(legs, 150)).toBeCloseTo(600, 6);
    // Max loss below 100 = −net debit
    expect(bookPayoffAt(legs, 90)).toBeCloseTo(-400, 6);
  });

  it("iron condor has defined credit profit between short strikes", () => {
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
    // Net credit = (2.5+2.5) − (1+1) = 3 → cash +300
    expect(netCashAtOpen(legs)).toBeCloseTo(300, 6);
    expect(bookPayoffAt(legs, 100)).toBeCloseTo(300, 6);
    // Outside long put wing: width 5 − credit 3 = max loss 2 → −200
    expect(bookPayoffAt(legs, 80)).toBeCloseTo(-200, 6);
    expect(bookPayoffAt(legs, 120)).toBeCloseTo(-200, 6);
  });
});
