import type { OptionLeg, StrategyValidation } from "./types";

export function validateLegs(legs: OptionLeg[]): StrategyValidation {
  const issues: StrategyValidation["issues"] = [];
  const warnings: string[] = [];

  if (legs.length === 0) {
    return {
      ok: false,
      issues: [
        {
          legId: "",
          field: "general",
          message: "Add a leg or load a strategy preset to see expiration P&L.",
        },
      ],
      warnings: [],
    };
  }

  for (const leg of legs) {
    if (!(leg.strike > 0) || !Number.isFinite(leg.strike)) {
      issues.push({
        legId: leg.id,
        field: "strike",
        message: "Strike must be greater than zero.",
      });
    }
    if (leg.premium < 0 || !Number.isFinite(leg.premium)) {
      issues.push({
        legId: leg.id,
        field: "premium",
        message: "Premium must be zero or greater.",
      });
    }
    if (leg.quantity === 0 || !Number.isFinite(leg.quantity)) {
      issues.push({
        legId: leg.id,
        field: "quantity",
        message: "Quantity cannot be zero.",
      });
    }
    if (!(leg.multiplier > 0) || !Number.isFinite(leg.multiplier)) {
      issues.push({
        legId: leg.id,
        field: "multiplier",
        message: "Multiplier must be greater than zero.",
      });
    }
  }

  // Soft warning only for simple 2-leg debit verticals with inverted strikes.
  // Skip 4-leg books (e.g. iron condor) where credit put/call spreads are expected.
  if (legs.length === 2) {
    const [a, b] = legs;
    if (a && b && a.type === b.type) {
      const longLeg = legs.find((l) => l.side === "long");
      const shortLeg = legs.find((l) => l.side === "short");
      if (longLeg && shortLeg) {
        const debit =
          longLeg.premium * longLeg.quantity * longLeg.multiplier -
          shortLeg.premium * shortLeg.quantity * shortLeg.multiplier;
        if (debit > 0) {
          if (a.type === "call" && longLeg.strike > shortLeg.strike) {
            warnings.push(
              "Call debit vertical looks inverted (long strike above short). Check strikes for a bull call spread.",
            );
          }
          if (a.type === "put" && longLeg.strike < shortLeg.strike) {
            warnings.push(
              "Put debit vertical looks inverted (long strike below short). Check strikes for a bear put spread.",
            );
          }
        }
      }
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}
