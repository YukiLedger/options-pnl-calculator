"use client";

import { LegEditor } from "@/components/leg-editor";
import { ModeToggle } from "@/components/mode-toggle";
import { PnlChart } from "@/components/pnl-chart";
import { RiskSummary } from "@/components/risk-summary";
import { StrategyPresets } from "@/components/strategy-presets";
import { ThemeToggle } from "@/components/theme-toggle";
import { VolCrushPanel } from "@/components/vol-crush-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyPreset,
  computeCrushStress,
  computeRiskMetrics,
  createDefaultSession,
  createEmptySession,
  decodeSession,
  encodeSession,
  newBlankLeg,
  validateLegs,
  validateVolParams,
  type ChartMode,
  type OptionLeg,
  type StrategySession,
  type VolParams,
} from "@/lib/options";
import { Link2, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

const PnlSurface3D = dynamic(
  () =>
    import("@/components/pnl-surface-3d").then((m) => m.PnlSurface3D),
  {
    ssr: false,
    loading: () => (
      <div className="panel flex h-[340px] items-center justify-center text-sm text-muted-foreground sm:h-[400px]">
        Loading 3D surface…
      </div>
    ),
  },
);

function readSessionFromUrl(): StrategySession {
  if (typeof window === "undefined") return createDefaultSession();
  const encoded = new URLSearchParams(window.location.search).get("s");
  if (encoded) {
    const decoded = decodeSession(encoded);
    if (decoded) return decoded;
  }
  return createDefaultSession();
}

function writeSessionToUrl(session: StrategySession) {
  const url = new URL(window.location.href);
  url.searchParams.set("s", encodeSession(session));
  window.history.replaceState(null, "", url.toString());
}

export function Workbench() {
  const [session, setSession] = useState<StrategySession>(createDefaultSession);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [chartKey, setChartKey] = useState("init");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readSessionFromUrl());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const handle = window.setTimeout(() => writeSessionToUrl(session), 200);
    return () => window.clearTimeout(handle);
  }, [session, ready]);

  const validation = useMemo(
    () => validateLegs(session.legs),
    [session.legs],
  );

  const metrics = useMemo(
    () => computeRiskMetrics(session.legs, session.spot),
    [session.legs, session.spot],
  );

  const crush = useMemo(
    () => computeCrushStress(session.legs, session.spot, session.vol),
    [session.legs, session.spot, session.vol],
  );

  const volOk = validateVolParams(session.vol).length === 0;

  const bumpChart = useCallback(() => {
    setChartKey(`chart-${Date.now()}`);
  }, []);

  const updateSession = useCallback(
    (updater: (prev: StrategySession) => StrategySession, redraw = false) => {
      setSession((prev) => updater(prev));
      if (redraw) bumpChart();
    },
    [bumpChart],
  );

  const handlePreset = (presetId: string) => {
    updateSession((prev) => applyPreset(prev, presetId), true);
  };

  const handleClear = () => {
    updateSession(
      (prev) => ({
        ...createEmptySession(),
        spot: prev.spot,
        ticker: prev.ticker,
        mode: prev.mode,
        vol: prev.vol,
      }),
      true,
    );
  };

  const handleLegChange = (legId: string, patch: Partial<OptionLeg>) => {
    updateSession((prev) => ({
      ...prev,
      presetId: null,
      legs: prev.legs.map((leg) =>
        leg.id === legId ? { ...leg, ...patch } : leg,
      ),
    }));
  };

  const handleAdd = () => {
    updateSession((prev) => ({
      ...prev,
      presetId: null,
      legs: [
        ...prev.legs,
        newBlankLeg(prev.legs[0]?.multiplier ?? 100),
      ].map((leg, i, arr) =>
        i === arr.length - 1
          ? { ...leg, strike: prev.spot || leg.strike }
          : leg,
      ),
    }));
  };

  const handleRemove = (legId: string) => {
    updateSession((prev) => ({
      ...prev,
      presetId: null,
      legs: prev.legs.filter((l) => l.id !== legId),
    }));
  };

  const handleDuplicate = (legId: string) => {
    updateSession((prev) => {
      const source = prev.legs.find((l) => l.id === legId);
      if (!source) return prev;
      const copy: OptionLeg = {
        ...source,
        id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      const idx = prev.legs.findIndex((l) => l.id === legId);
      const legs = [...prev.legs];
      legs.splice(idx + 1, 0, copy);
      return { ...prev, presetId: null, legs };
    });
  };

  const handleResetPreset = () => {
    if (session.presetId) {
      handlePreset(session.presetId);
    } else {
      handlePreset("iron-condor");
    }
  };

  const handleMode = (mode: ChartMode) => {
    updateSession((prev) => ({ ...prev, mode }), true);
  };

  const handleVol = (patch: Partial<VolParams>) => {
    updateSession((prev) => ({
      ...prev,
      vol: { ...prev.vol, ...patch },
    }));
  };

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", encodeSession(session));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      window.prompt("Copy share URL:", url.toString());
    }
  };

  const showVolPanel =
    session.mode === "markToModel" || session.mode === "ivCrush";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-teal uppercase">
              Options strategy workbench
            </p>
            <h1 className="font-heading mt-1 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Options P&L
            </h1>
          </div>
          <ThemeToggle />
        </div>
        <p className="mt-2 max-w-2xl text-base text-graphite sm:text-lg">
          Expiration payoff, mark-to-model, and earnings IV crush — kept in
          separate modes so terminal P&L never gets confused with theoretical
          value.
        </p>
      </header>

      <section className="panel mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div>
              <Label htmlFor="ticker" className="text-xs">
                Ticker
              </Label>
              <Input
                id="ticker"
                className="mt-1 h-9 font-medium tracking-wide uppercase"
                value={session.ticker}
                maxLength={12}
                onChange={(e) =>
                  updateSession((prev) => ({
                    ...prev,
                    ticker: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="spot" className="text-xs">
                Reference spot
              </Label>
              <Input
                id="spot"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                className="font-tabular mt-1 h-9"
                value={session.spot}
                onChange={(e) =>
                  updateSession((prev) => ({
                    ...prev,
                    spot: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs">Currency</Label>
              <div className="mt-1 flex h-9 items-center rounded-lg border border-input bg-muted/40 px-3 font-tabular text-sm text-muted-foreground">
                USD
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetPreset}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-paper px-3 text-sm font-medium hover:bg-muted"
            >
              <RotateCcw className="size-4" />
              Reset to preset
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-transparent bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <Link2 className="size-4" />
              {copyState === "copied" ? "Link copied" : "Copy share link"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel mb-4 p-4 sm:p-5">
        <ModeToggle mode={session.mode} onChange={handleMode} />
      </section>

      <section className="panel mb-4 p-4 sm:p-5">
        <StrategyPresets
          activePresetId={session.presetId}
          onSelect={handlePreset}
          onClear={handleClear}
        />
      </section>

      {showVolPanel ? (
        <div className="mb-4">
          <VolCrushPanel
            vol={session.vol}
            crush={crush}
            showCrushMetrics={session.mode === "ivCrush"}
            onChange={handleVol}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="order-2 lg:order-1 lg:col-span-5 xl:col-span-4">
          <LegEditor
            legs={session.legs}
            validation={validation}
            onChange={handleLegChange}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onDuplicate={handleDuplicate}
          />
        </div>
        <div className="order-1 space-y-4 lg:order-2 lg:col-span-7 xl:col-span-8">
          <RiskSummary
            metrics={metrics}
            spot={session.spot}
            hasLegs={session.legs.length > 0}
          />
          <PnlChart
            legs={session.legs}
            spot={session.spot}
            metrics={metrics}
            chartKey={chartKey}
            mode={session.mode}
            vol={session.vol}
            volOk={volOk}
          />
          <PnlSurface3D
            legs={session.legs}
            spot={session.spot}
            vol={session.vol}
            volOk={volOk}
          />
        </div>
      </div>

      <footer className="mt-8 border-t border-border/70 pt-4 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-graphite">
            Modes stay separate on purpose.
          </span>{" "}
          Expiration = terminal intrinsic vs entry premium. Mark-to-model /
          IV crush = flat-IV Black–Scholes European marks (rate &amp; dividend
          defaults). No skew surface, no fees, no early exercise.
        </p>
      </footer>
    </div>
  );
}
