import type { BoundMetric } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(
  value: number,
  options?: { signed?: boolean; compact?: boolean },
): string {
  const formatter = options?.compact ? usdCompact : usd;
  const abs = formatter.format(Math.abs(value));
  if (options?.signed) {
    if (value > 0) return `+${abs}`;
    if (value < 0) return `−${abs}`;
    return abs;
  }
  return value < 0 ? `−${abs}` : abs;
}

export function formatPrice(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatBound(
  bound: BoundMetric,
  options?: { signed?: boolean },
): string {
  if (bound.kind === "unlimited") {
    return bound.direction === "profit" ? "Unlimited" : "Unlimited loss";
  }
  return formatMoney(bound.value, { signed: options?.signed ?? true });
}

export function pnlTone(value: number): "profit" | "loss" | "flat" {
  if (value > 0.005) return "profit";
  if (value < -0.005) return "loss";
  return "flat";
}

export function netPremiumLabel(netPremium: number): {
  label: string;
  tone: "debit" | "credit" | "flat";
} {
  if (Math.abs(netPremium) < 0.005) {
    return { label: "Flat", tone: "flat" };
  }
  if (netPremium > 0) {
    return { label: `Net debit ${formatMoney(netPremium)}`, tone: "debit" };
  }
  return {
    label: `Net credit ${formatMoney(Math.abs(netPremium))}`,
    tone: "credit",
  };
}
