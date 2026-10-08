"use client";

import { Input } from "@/components/ui/input";
import { useEffect, useState, type ComponentProps } from "react";

interface NumberInputProps
  extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
  /** Allow empty while editing; commit last good value on blur if still empty/invalid. */
  allowEmpty?: boolean;
  min?: number;
  max?: number;
}

/**
 * Controlled numeric field that lets users delete/retype without snapping to 0.
 * (Native Number("") === 0 is why spot felt stuck.)
 */
export function NumberInput({
  value,
  onValueChange,
  allowEmpty = true,
  min,
  max,
  onBlur,
  onFocus,
  ...props
}: NumberInputProps) {
  const [draft, setDraft] = useState(() => formatDraft(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatDraft(value));
    }
  }, [value, focused]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (!isAllowedNumericDraft(raw)) return;
        setDraft(raw);

        if (raw.trim() === "" || raw === "-" || raw === "." || raw === "-.") {
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        if (min !== undefined && parsed < min) return;
        if (max !== undefined && parsed > max) return;
        onValueChange(parsed);
      }}
      onBlur={(e) => {
        setFocused(false);
        const parsed = Number(draft);
        const valid =
          draft.trim() !== "" &&
          Number.isFinite(parsed) &&
          (min === undefined || parsed >= min) &&
          (max === undefined || parsed <= max);

        if (valid) {
          onValueChange(parsed);
          setDraft(formatDraft(parsed));
        } else if (allowEmpty) {
          // Restore last committed value
          setDraft(formatDraft(value));
        }
        onBlur?.(e);
      }}
    />
  );
}

function formatDraft(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

function isAllowedNumericDraft(raw: string): boolean {
  return /^-?\d*\.?\d*$/.test(raw);
}
