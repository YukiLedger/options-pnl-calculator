import { describe, expect, it } from "vitest";
import {
  blackScholes,
  bookMarkPnl,
  bookVega,
  daysToYears,
  normCdf,
} from "./black-scholes";
import type { OptionLeg } from "./types";

describe("normCdf", () => {
  it("matches known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 4);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 2);
  });
});

describe("blackScholes", () => {
  it("prices a known ATM-ish European call", () => {
    // S=100, K=100, T=1y, r=0.05, q=0, σ=0.2 → call ≈ 10.45
    const { price, delta, vega } = blackScholes({
      spot: 100,
      strike: 100,
      timeYears: 1,
      rate: 0.05,
      dividendYield: 0,
      volatility: 0.2,
      type: "call",
    });
    expect(price).toBeCloseTo(10.4506, 2);
    expect(delta).toBeGreaterThan(0.5);
    expect(delta).toBeLessThan(0.7);
    expect(vega).toBeGreaterThan(0);
  });

  it("satisfies put-call parity (q=0)", () => {
    const S = 100;
    const K = 100;
    const T = 0.5;
    const r = 0.05;
    const vol = 0.25;
    const call = blackScholes({
      spot: S,
      strike: K,
      timeYears: T,
      rate: r,
      dividendYield: 0,
      volatility: vol,
      type: "call",
    }).price;
    const put = blackScholes({
      spot: S,
      strike: K,
      timeYears: T,
      rate: r,
      dividendYield: 0,
      volatility: vol,
      type: "put",
    }).price;
    const parity = call - put;
    const forward = S - K * Math.exp(-r * T);
    expect(parity).toBeCloseTo(forward, 4);
  });

  it("collapses to intrinsic at expiry", () => {
    expect(
      blackScholes({
        spot: 110,
        strike: 100,
        timeYears: 0,
        rate: 0.05,
        dividendYield: 0,
        volatility: 0.3,
        type: "call",
      }).price,
    ).toBeCloseTo(10, 8);
    expect(
      blackScholes({
        spot: 90,
        strike: 100,
        timeYears: 0,
        rate: 0.05,
        dividendYield: 0,
        volatility: 0.3,
        type: "put",
      }).price,
    ).toBeCloseTo(10, 8);
  });

  it("higher IV raises OTM option value", () => {
    const low = blackScholes({
      spot: 100,
      strike: 110,
      timeYears: daysToYears(30),
      rate: 0.05,
      dividendYield: 0,
      volatility: 0.2,
      type: "call",
    }).price;
    const high = blackScholes({
      spot: 100,
      strike: 110,
      timeYears: daysToYears(30),
      rate: 0.05,
      dividendYield: 0,
      volatility: 0.5,
      type: "call",
    }).price;
    expect(high).toBeGreaterThan(low);
  });
});

describe("book mark P&L / vega", () => {
  const longStraddle: OptionLeg[] = [
    {
      id: "c",
      side: "long",
      type: "call",
      strike: 100,
      premium: 5,
      quantity: 1,
      multiplier: 100,
    },
    {
      id: "p",
      side: "long",
      type: "put",
      strike: 100,
      premium: 5,
      quantity: 1,
      multiplier: 100,
    },
  ];

  it("long straddle has positive vega", () => {
    const v = bookVega(longStraddle, 100, 0.4, daysToYears(30), 0.05, 0);
    expect(v).toBeGreaterThan(0);
  });

  it("short straddle mark P&L rises when IV drops (same spot)", () => {
    const short = longStraddle.map((l) => ({
      ...l,
      side: "short" as const,
    }));
    const T = daysToYears(30);
    const highIvPnl = bookMarkPnl(short, 100, 0.5, T, 0.05, 0);
    const lowIvPnl = bookMarkPnl(short, 100, 0.3, T, 0.05, 0);
    // Short vol: cheaper theo after crush → mark P&L improves
    expect(lowIvPnl).toBeGreaterThan(highIvPnl);
  });
});
