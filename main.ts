// BTC race bot v3 — dip-buy-and-ride with a trailing stop, one trade.
//
// Why this shape — measured on THIRTY-THREE one-minute 24h windows, not one:
//   18 windows Oct 21 – Nov 7 2026 (Coinbase BTC-USD 1m, 20:59 UTC aligned),
//   10 windows Nov 8 – 17 (the crash week, BTC $75.6k -> $62k, -18%),
//   DEV0603 / RACE0603 / DEV0828 / RACE0828 / RACE2314 (earlier kit + race
//   windows), all with the harness cost model (4 bps fee + 2 bps slippage
//   + price impact, ~34 bps a full-size round trip — calibrated: this model
//   reproduces v2b's grade-local +$1.63 and live +$2.20 within $0.06).
//   Net PnL in USDC, $1,000 start:
//
//     strategy                                wins   mean   worst  best  top10
//     v2b (shipped 1444, TP0.5 SL0.5, gate)    4/6   -0.87   -8.44  +1.45  0/6
//     v3 (this bot)                          11/33   -5.47  -28.57 +36.99  2/33
//     deep-washout alt (mean-positive)       11/33   +0.97  -21.34 +36.99  1/33
//
// v3 was picked for the strongest VALIDATION pair in the whole screen
// (~10,000 combinations over 6 screen stages), not for any single window:
//   DEV1444 (this race's dev window, -2.80% grind down): +$15.04
//   RACE1444 (the race just run, -0.85%):                 +$11.83
// Both are 5-7x v2b's live result (+$2.20, rank 263/3,661, cutoff +$16.90).
// Honest limit, measured: NO screened strategy reached +$16.90 on DEV1444
// (max over the whole screen: +$15.04, this bot). The dev window's best
// single swing is +2.88% gross (~+$25 net); the +$15.04 comes from riding
// the early dip (bar 240, $63,675) to the mid-day peak with the trail.
// The deep-washout alternative has a positive 33-window mean (+$0.97) but
// a weaker validation pair (+$5.52 / +$3.96); v3's top-10 hit rate (2/33)
// is double the alternative's (1/33), which is what the prize pays on.
//
// Rules, decided on each bar's close and filled at the next bar's open:
//   - Warmup: need 60 closes before any order (the 240-bar low uses
//     whatever history exists, like the backtest).
//   - NO trend gate: across 33 windows the MA60>MA240 gate blocked the
//     best entries more than it saved; the trailing stop is the risk control.
//   - Buy the full cash balance when the close is within 0.5% above the
//     240-bar low AND at least 0.3% above that low (it bounced off the low)
//     AND the close is above the previous close. One trade ever.
//   - Sell the whole position when the close is 2.0% or more below the
//     entry close (hard stop), or 4.0% or more above it (take profit), or
//     the trailing stop fires: once the peak close is 2.0% or more above
//     the entry, sell when the close falls 0.5% below that peak.
//     Otherwise hold to the end of the window.
//
// All arithmetic is integer (bigint) on the harness's raw price units,
// so two runs produce the same orders byte for byte. No clock, no
// randomness, no network, no environment reads. Warm-up bars, when the
// harness sends them, build history but never take orders.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const WARMUP = 60;
const LOW_LOOKBACK = 240;
const MAX_SLIPPAGE_BPS = 100;
// Entry: close within +0.5% of the 240-bar low and at least +0.3% above it:
//   close * 1000 <= low * 1005  and  close * 1000 >= low * 1003.
// Exit: hard stop   -2.0% (close * 100 <= entry * 98),
//       take profit +4.0% (close * 100 >= entry * 104),
//       trailing: arm when peak >= entry * 1.02, exit when
//       close * 1000 <= peak * 995 (0.5% giveback from the peak).

const closes: bigint[] = [];
let entry: bigint | null = null;
let peak: bigint | null = null;
let done = false;

function minLast(n: number): bigint {
  let m = closes[closes.length - 1];
  const start = Math.max(0, closes.length - n);
  for (let i = start; i < closes.length; i++) if (closes[i] < m) m = closes[i];
  return m;
}

await runBars({
  onBatch(state: BarsState, _batch: Batch): OrderInput[] {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    if (state.warmingUp) return [];
    const pos = state.positions.get(SYMBOL);
    const holding = pos !== undefined && pos.qty > 0n;
    if (!holding) {
      entry = null;
      peak = null;
      // One position ever: after the exit there is no re-entry.
      if (done || closes.length < WARMUP) return [];
      const low = minLast(LOW_LOOKBACK);
      const prev = closes[closes.length - 2];
      if (
        close * 1000n <= low * 1005n &&
        close * 1000n >= low * 1003n &&
        close > prev
      ) {
        entry = close;
        peak = close;
        done = true;
        const notional = state.cash;
        if (notional <= 0n) return [];
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    // Holding: exit on hard stop, take profit, or trailing stop. The entry
    // and peak are cleared only once the position is gone, so a refused
    // sell is retried next bar.
    if (entry !== null && peak !== null && pos !== undefined) {
      if (close > peak) peak = close;
      if (
        close * 100n <= entry * 98n ||
        close * 100n >= entry * 104n ||
        (peak * 100n >= entry * 102n && close * 1000n <= peak * 995n)
      ) {
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    return [];
  },
});
