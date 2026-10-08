"use client";

import type { QuoteResult } from "@/app/api/quote/route";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/options";
import { cn } from "@/lib/utils";
import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TickerFieldProps {
  ticker: string;
  onTickerChange: (ticker: string) => void;
  onQuote: (quote: QuoteResult) => void;
}

type QuoteStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; quote: QuoteResult }
  | { kind: "error"; message: string };

export function TickerField({
  ticker,
  onTickerChange,
  onQuote,
}: TickerFieldProps) {
  const [status, setStatus] = useState<QuoteStatus>({ kind: "idle" });
  const lastFetched = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = async (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) {
      setStatus({ kind: "error", message: "Enter a ticker symbol." });
      return;
    }
    if (symbol === "DEMO") {
      setStatus({
        kind: "error",
        message: "DEMO is a local label. Try AAPL, SPY, MSFT, TSLA…",
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: "loading" });

    try {
      const res = await fetch(
        `/api/quote?symbol=${encodeURIComponent(symbol)}`,
        { signal: controller.signal },
      );
      const data = (await res.json()) as QuoteResult & { error?: string };
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error ?? `No quote for ${symbol}.`,
        });
        return;
      }
      lastFetched.current = data.symbol;
      setStatus({ kind: "ready", quote: data });
      onQuote(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStatus({
        kind: "error",
        message: "Quote request failed. Check your connection and retry.",
      });
    }
  };

  // Cleanup in-flight request on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="col-span-2 sm:col-span-1">
      <Label htmlFor="ticker" className="text-xs">
        Ticker
      </Label>
      <div className="mt-1 flex gap-1.5">
        <Input
          id="ticker"
          className="h-9 font-medium tracking-wide uppercase"
          value={ticker}
          maxLength={24}
          placeholder="AAPL"
          spellCheck={false}
          autoCapitalize="characters"
          onChange={(e) => {
            onTickerChange(e.target.value.toUpperCase());
            if (status.kind !== "idle" && status.kind !== "loading") {
              setStatus({ kind: "idle" });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void lookup(ticker);
            }
          }}
          onBlur={() => {
            const symbol = ticker.trim().toUpperCase();
            if (
              symbol &&
              symbol !== "DEMO" &&
              symbol !== lastFetched.current &&
              status.kind !== "loading"
            ) {
              void lookup(symbol);
            }
          }}
        />
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-paper px-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          onClick={() => void lookup(ticker)}
          disabled={status.kind === "loading" || !ticker.trim()}
          title="Load last price into reference spot"
        >
          {status.kind === "loading" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          <span className="hidden sm:inline">Quote</span>
        </button>
      </div>

      {status.kind === "ready" ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-ink">{status.quote.name}</span>
          {" · "}
          <span className="font-tabular">
            {status.quote.currency} {formatPrice(status.quote.price)}
          </span>
          {status.quote.changePercent !== null ? (
            <span
              className={cn(
                "font-tabular",
                status.quote.changePercent >= 0 ? "text-profit" : "text-loss",
              )}
            >
              {" "}
              ({status.quote.changePercent >= 0 ? "+" : ""}
              {status.quote.changePercent.toFixed(2)}%)
            </span>
          ) : null}
        </p>
      ) : null}

      {status.kind === "error" ? (
        <p className="mt-1.5 text-xs text-loss">{status.message}</p>
      ) : null}

      {status.kind === "idle" ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Type a symbol and press Enter / Quote to set spot from last price.
        </p>
      ) : null}
    </div>
  );
}
