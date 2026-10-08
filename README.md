# Options P&L

A browser-native **multi-leg options strategy workbench** for expiration P&L and earnings **IV crush** stress.

Build call/put legs, load desk-familiar presets, then switch modes: terminal payoff, flat-IV Black–Scholes marks, or pre-event vs post-crush dual curves — without conflating those models.

**One-line pitch:** *A trading-desk whiteboard for equity options: compose legs, stress earnings IV crush, and keep expiration payoff strictly separate from mark-to-model.*

**Locked differentiator:** Volatility crush & earnings stress testing (flat IV + global crush %).

## What’s in v1

- Multi-leg book editor (buy/sell, call/put, strike, premium, qty, multiplier)
- Strategy presets with editable legs
- **Analysis modes:** Expiration · Mark-to-model · IV crush
- Instant P&L chart (Recharts) with spot / strike / breakeven guides
- Dual pre-event / post-crush curves + vega / crush Δ callouts
- **3D mark surface** (Spot × IV × P&L) with numeric axis ticks, value callouts, and pre/post-crush ridges
- **Dark mode** night-desk theme (persisted) alongside daylight graphite/teal
- Risk summary: max profit/loss (or unlimited), breakevens, net debit/credit, P&L at spot
- Shareable URL state (strategy encoded in the query string)
- Unit-tested payoff + Black–Scholes + crush + surface engine under `src/lib/options/`

**Explicitly not in v1:** vol skew smile fitting, full Greeks dashboard, live market data, auth, or a backend.

## Assumptions

1. **Expiration mode:** European-style terminal intrinsic vs entry premium
2. **Mark-to-model / IV crush:** flat session IV, continuous rate & dividend yield (defaults 5% / 0%), European BSM
3. Crush: `postIV = preIV × (1 − crush%)` — no skew
4. Premium is the user-entered entry price (not a live mid)
5. Default multiplier `100` (US equity options convention)
6. No fees, slippage, or assignment mechanics
7. Short calls may show **unlimited** max loss on the expiration curve

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Recharts · Vitest

## Run locally

```bash
npm install
npm run dev -- --port 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

```bash
npm test          # Vitest payoff / metrics fixtures
npm run build     # production build
```

## Project layout

```
src/
  app/                 # Next.js shell
  components/          # Leg editor, presets, chart, risk summary
  lib/options/         # Pure domain math + tests
```

## Deploy

Deploy on Vercel (or any Next.js host). No environment variables required — the demo is fully client-side.

## Interview demo (~2 min)

1. Open the live URL — Iron Condor + **IV crush** mode loads by default  
2. Show dual curves: pre-event vs post-crush; call out short-vega crush Δ at spot  
3. Switch to **Long Straddle** — long vega “can lose even if underlying goes your way”  
4. Flip to **Expiration** mode — same book, terminal payoff only (modes stay separate)  
5. Mention: *flat IV + global crush only — no skew surface yet*
