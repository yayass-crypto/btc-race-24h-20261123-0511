[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/yayass-crypto/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/yayass-crypto/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

# BTC race bot v3 — btc-race-24h-20261123-0511

Dip-buy-and-ride with a trailing stop. Full size, one trade at most, no
trend gate.

Built for [make.fun's Race a BTC trading bot live for 24 hours bounty](https://make.fun/bounty/btc-race-24h-20261123-0511) ($50 USDC, 10 paid places).

> Submitted to btc-race-24h-20261123-0511 (opened 2026-11-23 05:11 UTC,
> deadline 11:11 UTC). This bot is v3, first built and verified on the
> btc-race-24h-20261118-1444 kit before this race opened; the slug, badges
> and bounty link were updated for this race in the submission session.

This bot is v3 of the strategy that raced btc-race-24h-20261118-1444.
v2b (dip-buy, TP 0.5% / SL 0.5%, MA60>MA240 gate, one trade) made money
but finished far from the prize: **+$2.20, rank 263/3,661** (top-10
cutoff was +$16.90). The forensic replay showed why: it bought at bar
706 near the top of the day's rally, after a 240-bar warmup and a slow
gate had blocked the early dip, and its 0.5% take-profit capped the one
trade it ever made. The day's best swing (bar 110 → 889, +3.19% gross)
was worth about +$28 net — v2b was never positioned for it.

v3 was chosen from ~10,000 combinations over 6 screen stages on
**33 one-minute 24h windows** (Oct 21 – Nov 19, 2026, plus the earlier
kit and race windows), with a calibrated cost model (4 bps fee + 2 bps
slippage + price impact, ~34 bps a full-size round trip — the model
reproduces v2b's grade-local +$1.63 and live +$2.20 within $0.06).
It buys a dip (within 0.5% above the 240-bar low, bounced 0.3% off it,
rising), takes **one trade ever**, and rides it with a trailing stop
(arms at +2.0% from entry, exits on a 0.5% pullback from the peak),
with a +4.0% take-profit and a −2.0% hard stop as backstops. No trend
gate: across 33 windows the gate blocked the best entries more than it
saved.

Measured results (USDC, $1,000 start):

| window set | wins | mean | worst | best | top-10 hits |
|---|---:|---:|---:|---:|---:|
| 33 screening windows | 11/33 | −5.47 | −28.57 | +36.99 | 2/33 |
| DEV1444 (dev window, −2.80%) | — | **+15.04** | — | — | — |
| RACE1444 (race just run, −0.85%) | — | **+11.83** | — | — | — |

DEV1444: buy bar 240 @ $63,675, sell bar 529 @ $64,860 via trailing
stop. RACE1444: buy bar 360 @ $62,527, sell bar 633 @ $63,483 via
trailing stop. Both are 5–7x v2b's live result.

Honest limit, measured: no screened strategy reached +$16.90 on
DEV1444 (max over the whole screen: +$15.04, this bot). The dev
window's best single swing is +2.88% gross (~+$25 net). A
mean-positive alternative (deep-washout entry, 33-window mean +$0.97,
wins 11/33) was documented in the build record but has a weaker
validation pair (+$5.52 / +$3.96) and half the top-10 hit rate (1/33),
so v3 ships instead.

## How it works

- Warmup: 60 closes before any order (the 240-bar low uses whatever
  history exists).
- Entry: close within +0.5% of the 240-bar low, at least +0.3% above
  that low, and above the previous close. Full cash, one trade ever.
- Exit: hard stop −2.0%, take profit +4.0%, or trailing stop (arms at
  +2.0% peak vs entry, exits on 0.5% giveback from the peak).
- All arithmetic is integer (bigint) on the harness's raw price units;
  deterministic, no clock, no randomness, no network.

## Verification

Grade-local on this race's own kit (btc-race-24h-20261123-0511, process
driver) — **net PnL +$10.91 USDC**, 2 trades (1 round trip), win rate 1.0,
max drawdown 0.93%, fees $0.81, L1 regrade reproduced — **passes the dev
gate (> $0)**. Dev window: 1,440 bars, $58,957 → $61,102 (+3.64%).
Result sha256 `0e7fb04496d8c99e8b57b9e8229712146ab329a5dd35085b99fd03ba946ba2cb`.
The deep-washout alternative (33-window mean +$0.97) was simmed on this
same window and made $0.00 with 0 trades, so v3 ships.

Grade-local on the 1444 kit (process driver) — see the build record
`~/workspace/makefun/btc-race-v3-build-record.md` for the exact figure
and the Python-sim cross-check. Submit only if the grade is above $0
on the new race's own dev window.
