import {
  DEFAULT_VOL_PARAMS,
  type ChartMode,
  type OptionLeg,
  type OptionSide,
  type OptionType,
  type StrategySession,
  type VolParams,
} from "./types";

type CompactLeg = [
  OptionSide,
  OptionType,
  number,
  number,
  number,
  number,
  string,
];

interface CompactSession {
  s: number;
  t: string;
  c: string;
  p: string | null;
  l: CompactLeg[];
  m?: ChartMode;
  v?: Partial<VolParams>;
}

function isSide(v: unknown): v is OptionSide {
  return v === "long" || v === "short";
}

function isType(v: unknown): v is OptionType {
  return v === "call" || v === "put";
}

function isMode(v: unknown): v is ChartMode {
  return v === "expiration" || v === "markToModel" || v === "ivCrush";
}

function mergeVol(raw: Partial<VolParams> | undefined): VolParams {
  const base = { ...DEFAULT_VOL_PARAMS };
  if (!raw || typeof raw !== "object") return base;
  if (typeof raw.iv === "number" && Number.isFinite(raw.iv)) base.iv = raw.iv;
  if (typeof raw.daysToExpiry === "number" && Number.isFinite(raw.daysToExpiry)) {
    base.daysToExpiry = raw.daysToExpiry;
  }
  if (typeof raw.rate === "number" && Number.isFinite(raw.rate)) {
    base.rate = raw.rate;
  }
  if (
    typeof raw.dividendYield === "number" &&
    Number.isFinite(raw.dividendYield)
  ) {
    base.dividendYield = raw.dividendYield;
  }
  if (typeof raw.crushPct === "number" && Number.isFinite(raw.crushPct)) {
    base.crushPct = raw.crushPct;
  }
  if (typeof raw.eventLabel === "string") base.eventLabel = raw.eventLabel;
  return base;
}

export function encodeSession(session: StrategySession): string {
  const payload: CompactSession = {
    s: session.spot,
    t: session.ticker,
    c: session.currency,
    p: session.presetId,
    l: session.legs.map((leg) => [
      leg.side,
      leg.type,
      leg.strike,
      leg.premium,
      leg.quantity,
      leg.multiplier,
      leg.id,
    ]),
    m: session.mode,
    v: session.vol,
  };
  const json = JSON.stringify(payload);
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(json)));
  }
  return Buffer.from(json, "utf8").toString("base64");
}

export function decodeSession(encoded: string): StrategySession | null {
  try {
    const json =
      typeof atob === "function"
        ? decodeURIComponent(escape(atob(encoded)))
        : Buffer.from(encoded, "base64").toString("utf8");
    const raw = JSON.parse(json) as CompactSession;
    if (
      typeof raw.s !== "number" ||
      !Number.isFinite(raw.s) ||
      !Array.isArray(raw.l)
    ) {
      return null;
    }
    const legs: OptionLeg[] = [];
    for (const item of raw.l) {
      if (!Array.isArray(item) || item.length < 6) continue;
      const [side, type, strike, premium, quantity, multiplier, id] = item;
      if (!isSide(side) || !isType(type)) continue;
      if (
        ![strike, premium, quantity, multiplier].every(
          (n) => typeof n === "number" && Number.isFinite(n),
        )
      ) {
        continue;
      }
      legs.push({
        id: typeof id === "string" ? id : `leg-${legs.length + 1}`,
        side,
        type,
        strike,
        premium,
        quantity,
        multiplier,
      });
    }
    return {
      spot: raw.s,
      ticker: typeof raw.t === "string" ? raw.t : "",
      currency: typeof raw.c === "string" ? raw.c : "USD",
      presetId: typeof raw.p === "string" ? raw.p : null,
      legs,
      mode: isMode(raw.m) ? raw.m : "ivCrush",
      vol: mergeVol(raw.v),
    };
  } catch {
    return null;
  }
}
