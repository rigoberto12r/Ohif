# gridbot — Adaptive Grid Trading Bot (Phase 1: engine + backtester)

An adaptive grid trading strategy engine for Binance spot, built backtest-first.
This phase contains **no live trading** — it is the strategy engine, a
pessimistic backtester, and the tooling to validate parameters on historical
data before any real money (or even testnet) is involved.

> **Risk warning.** Grid trading is short-volatility: it earns small amounts
> often and can lose a lot once. It only has an edge in mean-reverting
> (sideways) markets; in a sustained downtrend it averages down into a losing
> position, and in a strong uptrend it underperforms buy & hold. The risk
> controls here bound the damage — they do not remove it. Nothing in this
> repository is financial advice.

## Design

The core decision is the **engine/executor split**:

- `gridbot/strategy.py` — a pure state machine. It consumes closed candles
  (with precomputed indicators) and fill events, and emits order intents
  (`PlaceOrder` / `CancelOrder` / `MarketSell`). No I/O, no clock, no
  exchange. The exact code that is backtested is the code that will trade.
- `gridbot/executor/` — turns intents into (simulated) exchange operations.
  Phase 2 adds a live ccxt executor behind the same interface.

### The adaptive parts

| Mechanism | What it does |
|---|---|
| ATR spacing | Level spacing = `atr_mult × ATR(14) / price`, floored at `max(min_spacing_pct, 2×(2×fee + slippage))` so a round trip can never be structurally unprofitable. |
| Recentering | After `recenter_candles` consecutive closes outside the grid range, the grid is rebuilt around the current price. Inventory policy `keep` (default) holds the bag with its take-profits open; `flush` liquidates. |
| Regime filter | Buys pause while ADX(14) > threshold or price < daily EMA200 (computed without look-ahead). A grid that knows when to be off is the single most profitable "feature". |

### The non-negotiable risk controls

- **Exposure cap** — buys are sized so a fully deployed ladder equals
  `max_exposure_pct` of capital (default 65%), and the engine refuses to
  average down past it.
- **Global stop** — if price falls `global_stop_pct` (default 12%) below the
  average cost of the inventory, everything is liquidated and the engine
  halts (`STOPPED`) until a human looks at it.

### The backtester is deliberately pessimistic

Limit buys at `P` fill only if the candle trades strictly through `P`, at `P`
plus slippage — never better, even on a gap in your favor. Sells mirror that.
Fees are charged on every fill. Orders placed on candle T can only fill from
T+1, so profits never compound within a candle. Decisions use only closed
candles. Partial fills are not modeled (documented v1 simplification).

## Usage

```bash
pip install -e ".[dev]"

# download real data (public Binance endpoints, no API key)
python -m gridbot.cli fetch-data --symbol BTC/USDT --timeframe 1h --since 2022-06-01

# or, offline, generate synthetic data for a smoke test
python -m gridbot.cli demo-data

# run a backtest
python -m gridbot.cli backtest configs/btcusdt-1h.yaml
python -m gridbot.cli backtest configs/btcusdt-1h.yaml --data data/DEMOUSDT-1h.parquet

# tests
python -m pytest
```

Configuration lives in YAML (see `configs/btcusdt-1h.yaml`); every parameter
mentioned above is set there.

## What the numbers look like

On synthetic **sideways** data (the regime grids are for), the integration
tests verify the grid nets positive after fees, and that higher fees strictly
reduce PnL. On synthetic **crashes** (-55%), the global stop caps the loss
near `max_exposure × global_stop` (≈ -8% vs -55% buy & hold). On pure random
walks the grid has no edge — as expected, since grid profit *is* the
mean-reversion premium. Validate on real data for the pair and period you
care about, and treat any backtest as an upper bound on live performance.

## Layout

```
gridbot/
  config.py      # YAML config -> dataclasses
  indicators.py  # Wilder ATR/ADX, EMA, no-look-ahead daily EMA
  grid.py        # geometric level layout, adaptive spacing
  portfolio.py   # inventory, avg cost, realized PnL, fees
  strategy.py    # the engine (pure state machine)
  executor/      # abstract interface + pessimistic backtest executor
  backtest.py    # loop: data -> indicators -> engine -> executor -> metrics
  metrics.py     # PnL, drawdown, trade counts, buy & hold benchmark
  data.py        # ccxt kline download + parquet cache + synthetic generator
  cli.py         # fetch-data / demo-data / backtest
```

## Phase 2 (not in this repo yet)

Live/testnet executor (authenticated ccxt), state reconciliation against the
exchange on restart, kill switch, notifications. The engine is already
serializable-state and side-effect-free specifically so that phase is an
executor swap, not a rewrite.
