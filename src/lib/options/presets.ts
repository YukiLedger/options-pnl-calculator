import type { OptionLeg, StrategySession } from "./types";
import { DEFAULT_VOL_PARAMS } from "./types";

export interface StrategyPreset {
  id: string;
  name: string;
  shortName: string;
  description: string;
  build: (spot: number, multiplier?: number) => OptionLeg[];
}

function id(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

function roundStrike(spot: number, offset = 0): number {
  const base = Math.round(spot / 5) * 5;
  return Math.max(5, base + offset);
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: "long-call",
    name: "Long Call",
    shortName: "Long Call",
    description: "Bullish directional; unlimited upside, loss capped at premium.",
    build: (spot, multiplier = 100) => {
      const k = roundStrike(spot, 5);
      return [
        {
          id: id("lc", 1),
          side: "long",
          type: "call",
          strike: k,
          premium: Number((spot * 0.04).toFixed(2)),
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
  {
    id: "long-put",
    name: "Long Put",
    shortName: "Long Put",
    description: "Bearish directional; profit as underlying falls below strike.",
    build: (spot, multiplier = 100) => {
      const k = roundStrike(spot, -5);
      return [
        {
          id: id("lp", 1),
          side: "long",
          type: "put",
          strike: k,
          premium: Number((spot * 0.04).toFixed(2)),
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
  {
    id: "bull-call-vertical",
    name: "Bull Call Vertical",
    shortName: "Bull Call",
    description: "Debit call spread: long lower strike, short higher strike.",
    build: (spot, multiplier = 100) => {
      const k1 = roundStrike(spot, -5);
      const k2 = roundStrike(spot, 10);
      const width = k2 - k1;
      const debit = Number((width * 0.4).toFixed(2));
      const shortPrem = Number((debit * 0.35).toFixed(2));
      const longPrem = Number((debit + shortPrem).toFixed(2));
      return [
        {
          id: id("bcv", 1),
          side: "long",
          type: "call",
          strike: k1,
          premium: longPrem,
          quantity: 1,
          multiplier,
        },
        {
          id: id("bcv", 2),
          side: "short",
          type: "call",
          strike: k2,
          premium: shortPrem,
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
  {
    id: "bear-put-vertical",
    name: "Bear Put Vertical",
    shortName: "Bear Put",
    description: "Debit put spread: long higher strike, short lower strike.",
    build: (spot, multiplier = 100) => {
      const k1 = roundStrike(spot, -10);
      const k2 = roundStrike(spot, 5);
      const width = k2 - k1;
      const debit = Number((width * 0.4).toFixed(2));
      const shortPrem = Number((debit * 0.35).toFixed(2));
      const longPrem = Number((debit + shortPrem).toFixed(2));
      return [
        {
          id: id("bpv", 1),
          side: "long",
          type: "put",
          strike: k2,
          premium: longPrem,
          quantity: 1,
          multiplier,
        },
        {
          id: id("bpv", 2),
          side: "short",
          type: "put",
          strike: k1,
          premium: shortPrem,
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
  {
    id: "long-straddle",
    name: "Long Straddle",
    shortName: "Straddle",
    description: "Long ATM call + put; profits from a large move either way.",
    build: (spot, multiplier = 100) => {
      const k = roundStrike(spot, 0);
      const prem = Number((spot * 0.035).toFixed(2));
      return [
        {
          id: id("ls", 1),
          side: "long",
          type: "call",
          strike: k,
          premium: prem,
          quantity: 1,
          multiplier,
        },
        {
          id: id("ls", 2),
          side: "long",
          type: "put",
          strike: k,
          premium: prem,
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
  {
    id: "short-straddle",
    name: "Short Straddle",
    shortName: "Short Straddle",
    description: "Short ATM call + put; collect premium, unlimited wing risk.",
    build: (spot, multiplier = 100) => {
      const k = roundStrike(spot, 0);
      const prem = Number((spot * 0.035).toFixed(2));
      return [
        {
          id: id("ss", 1),
          side: "short",
          type: "call",
          strike: k,
          premium: prem,
          quantity: 1,
          multiplier,
        },
        {
          id: id("ss", 2),
          side: "short",
          type: "put",
          strike: k,
          premium: prem,
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
  {
    id: "iron-condor",
    name: "Iron Condor",
    shortName: "Iron Condor",
    description:
      "Short OTM put/call spreads: defined risk, profits if price stays between short strikes.",
    build: (spot, multiplier = 100) => {
      const putLong = roundStrike(spot, -20);
      const putShort = roundStrike(spot, -10);
      const callShort = roundStrike(spot, 10);
      const callLong = roundStrike(spot, 20);
      return [
        {
          id: id("ic", 1),
          side: "long",
          type: "put",
          strike: putLong,
          premium: 1.2,
          quantity: 1,
          multiplier,
        },
        {
          id: id("ic", 2),
          side: "short",
          type: "put",
          strike: putShort,
          premium: 2.8,
          quantity: 1,
          multiplier,
        },
        {
          id: id("ic", 3),
          side: "short",
          type: "call",
          strike: callShort,
          premium: 2.8,
          quantity: 1,
          multiplier,
        },
        {
          id: id("ic", 4),
          side: "long",
          type: "call",
          strike: callLong,
          premium: 1.2,
          quantity: 1,
          multiplier,
        },
      ];
    },
  },
];

export function getPreset(id: string): StrategyPreset | undefined {
  return STRATEGY_PRESETS.find((p) => p.id === id);
}

export function createEmptySession(): StrategySession {
  return {
    spot: 100,
    ticker: "DEMO",
    currency: "USD",
    legs: [],
    presetId: null,
    mode: "expiration",
    vol: { ...DEFAULT_VOL_PARAMS },
  };
}

export function createDefaultSession(): StrategySession {
  const spot = 100;
  const preset = getPreset("iron-condor")!;
  return {
    spot,
    ticker: "DEMO",
    currency: "USD",
    legs: preset.build(spot),
    presetId: preset.id,
    mode: "ivCrush",
    vol: { ...DEFAULT_VOL_PARAMS },
  };
}

export function applyPreset(
  session: StrategySession,
  presetId: string,
): StrategySession {
  const preset = getPreset(presetId);
  if (!preset) return session;
  const multiplier = session.legs[0]?.multiplier ?? 100;
  return {
    ...session,
    legs: preset.build(session.spot, multiplier),
    presetId,
  };
}

export function newBlankLeg(multiplier = 100): OptionLeg {
  return {
    id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    side: "long",
    type: "call",
    strike: 100,
    premium: 2.5,
    quantity: 1,
    multiplier,
  };
}
