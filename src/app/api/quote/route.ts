import { NextResponse } from "next/server";

export type QuoteResult = {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  changePercent: number | null;
  asOf: string | null;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        shortName?: string;
        longName?: string;
        currency?: string;
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }> | null;
    error?: { code?: string; description?: string } | null;
  };
};

function normalizeSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!symbol || symbol === "DEMO") return null;
  // Yahoo-style tickers: AAPL, BRK-B, ^GSPC, EURUSD=X
  if (!/^[A-Z0-9.^%=-]{1,24}$/.test(symbol)) return null;
  return symbol;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = normalizeSymbol(searchParams.get("symbol") ?? "");

  if (!symbol) {
    return NextResponse.json(
      {
        error:
          "Enter a real ticker (e.g. AAPL, SPY, MSFT). DEMO is a local label only.",
      },
      { status: 400 },
    );
  }

  try {
    const url = new URL("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol));
    url.searchParams.set("interval", "1d");
    url.searchParams.set("range", "5d");

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OptionsPnLBot/1.0; +https://github.com/YukiLedger/options-pnl-calculator)",
        Accept: "application/json",
      },
      // Fresh-ish quotes; still fine if cached briefly
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Quote service returned ${res.status} for ${symbol}.` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as YahooChartResponse;
    if (data.chart?.error) {
      return NextResponse.json(
        {
          error:
            data.chart.error.description ??
            `No quote found for ${symbol}.`,
        },
        { status: 404 },
      );
    }

    const meta = data.chart?.result?.[0]?.meta;
    const price =
      meta?.regularMarketPrice ??
      meta?.chartPreviousClose ??
      meta?.previousClose;

    if (!meta || !(typeof price === "number" && Number.isFinite(price) && price > 0)) {
      return NextResponse.json(
        {
          error: `No usable price for “${symbol}”. Check the ticker (Yahoo format, e.g. BRK-B).`,
        },
        { status: 404 },
      );
    }

    const quote: QuoteResult = {
      symbol: meta.symbol ?? symbol,
      name: meta.longName ?? meta.shortName ?? meta.symbol ?? symbol,
      price: Number(price.toFixed(4)),
      currency: meta.currency ?? "USD",
      changePercent:
        typeof meta.regularMarketChangePercent === "number"
          ? meta.regularMarketChangePercent
          : null,
      asOf:
        typeof meta.regularMarketTime === "number"
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null,
    };

    return NextResponse.json(quote);
  } catch {
    return NextResponse.json(
      { error: "Could not reach the quote service. Try again in a moment." },
      { status: 502 },
    );
  }
}
