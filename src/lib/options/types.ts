export type OptionType = "call" | "put";
export type OptionSide = "long" | "short";

/** Chart / analysis mode — keep expiration payoff and mark-to-model strictly separated. */
export type ChartMode = "expiration" | "markToModel" | "ivCrush";

export interface OptionLeg {
  id: string;
  side: OptionSide;
  type: OptionType;
  strike: number;
  /** Entry premium per share (always ≥ 0). Debit paid when long; credit received when short. */
  premium: number;
  quantity: number;
  multiplier: number;
}

/** Flat-IV mark-to-model + crush inputs (session-level). */
export interface VolParams {
  /** Flat implied vol as a decimal (0.45 = 45%). */
  iv: number;
  daysToExpiry: number;
  /** Continuous risk-free rate (decimal). */
  rate: number;
  /** Continuous dividend yield (decimal). */
  dividendYield: number;
  /**
   * Crush magnitude as a fraction of pre-event IV.
   * 0.40 means post-IV = pre-IV × (1 − 0.40).
   */
  crushPct: number;
  /** Optional framing label, e.g. "Earnings". */
  eventLabel: string;
}

export interface StrategySession {
  spot: number;
  ticker: string;
  currency: string;
  legs: OptionLeg[];
  presetId: string | null;
  mode: ChartMode;
  vol: VolParams;
}

export interface PayoffPoint {
  underlying: number;
  pnl: number;
}

export type BoundMetric =
  | { kind: "finite"; value: number }
  | { kind: "unlimited"; direction: "profit" | "loss" };

export interface RiskMetrics {
  netPremium: number;
  /** Positive = net debit paid; negative = net credit received (cash convention used by UI). */
  netCashAtOpen: number;
  pnlAtSpot: number;
  maxProfit: BoundMetric;
  maxLoss: BoundMetric;
  breakevens: number[];
}

export interface CrushStressResult {
  ok: boolean;
  errors: string[];
  preIv: number;
  postIv: number;
  prePnl: number;
  postPnl: number;
  /** postPnl − prePnl at fixed spot (pure crush impact). */
  crushPnl: number;
  /** Signed book vega in currency per 1 vol point. */
  vegaPerVolPoint: number;
  shortVega: boolean;
  /** True when short vega and crush hurts at spot — interview callout. */
  canLoseIfUnderlyingFavorable: boolean;
}

export interface LegValidationIssue {
  legId: string;
  field: keyof OptionLeg | "general";
  message: string;
}

export interface StrategyValidation {
  ok: boolean;
  issues: LegValidationIssue[];
  warnings: string[];
}

export const DEFAULT_VOL_PARAMS: VolParams = {
  iv: 0.45,
  daysToExpiry: 30,
  rate: 0.05,
  dividendYield: 0,
  crushPct: 0.4,
  eventLabel: "Earnings",
};
