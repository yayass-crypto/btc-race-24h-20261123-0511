// Dip-buy-and-ride on CBBTC, one trade ever.
//
// Idea: wait for price to dip to within a narrow band (0.3%-0.5%) above the
// lowest close of the last 240 bars, and only while it is already ticking back
// up (close above the previous close). That is a dip near a recent low with
// momentum turning, not a falling knife. Buy once with all cash, then ride:
// exit on a hard -2% stop, take +4% profit, or once the peak is +2% above
// entry, bail on a 0.5% pullback from that peak. No re-entry after the exit,
// so the worst case is a single small losing trade and the best case is a
// short ride up with the trailing stop locking in most of it.
//
// All arithmetic is integer (bigint) on the harness's raw price units; the
// strategy is fully deterministic — no clock, no randomness, no network.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// History of closes, in bar order; the running entry/peak once bought;
// done means the one allowed trade has been taken (never re-enter).
const closes: bigint[] = [];
let entry: bigint | null = null;
let peak: bigint | null = null;
let done = false;

function onBatch(state: BarsState, _batch: Batch): OrderInput[] {
  const close = state.close(SYMBOL);
  if (close === null) return [];

  // Record this bar's close first; every decision below uses it.
  closes.push(close);

  // Warm-up bars build history but never take orders.
  if (state.warmingUp) return [];

  const pos = state.positions.get(SYMBOL);
  const holding = pos !== undefined && pos.qty > 0n;

  if (!holding) {
    entry = null;
    peak = null;
    if (done) return [];
    // Need enough history for the entry band to mean anything.
    if (closes.length < 60) return [];

    // Lowest close over the last up-to-240 bars.
    const window = closes.slice(-240);
    let low = window[0]!;
    for (const c of window) if (c < low) low = c;

    const prev = closes[closes.length - 2]!;
    // Dip band: within 0.3%-0.5% above the 240-bar low, and ticking up.
    const inBand =
      close * 1000n <= low * 1005n &&
      close * 1000n >= low * 1003n &&
      close > prev;
    if (!inBand) return [];

    if (state.cash <= 0n) return [];
    entry = close;
    peak = close;
    done = true;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: 100 }];
  }

  // Holding: track the peak and check the three exits.
  if (entry === null || peak === null) return [];
  if (close > peak) peak = close;

  const stopLoss = close * 100n <= entry * 98n;
  const takeProfit = close * 100n >= entry * 104n;
  const trailingStop =
    peak * 100n >= entry * 102n && close * 1000n <= peak * 995n;
  if (!stopLoss && !takeProfit && !trailingStop) return [];

  // Keep entry/peak so a refused sell is retried next bar; done stays true,
  // so after the exit there is no re-entry.
  return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: 100 }];
}

await runBars({ onBatch });
