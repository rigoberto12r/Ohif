"""Backtest loop: data -> indicators -> strategy -> executor -> metrics."""

from __future__ import annotations

import pandas as pd

from .config import BotConfig
from .executor.backtest import BacktestExecutor
from .indicators import adx, atr, daily_ema_no_lookahead
from .metrics import BacktestResult, build_result
from .strategy import Candle, GridStrategy, Snapshot


def prepare_indicators(df: pd.DataFrame, cfg: BotConfig) -> pd.DataFrame:
    """Add atr/adx/daily_ema columns, shifted so candle T only uses data
    through candle T's own close (decisions happen ON the close of T)."""
    out = df.copy()
    out["atr"] = atr(out, cfg.grid.atr_period)
    out["adx"] = adx(out, cfg.regime.adx_period)
    if cfg.regime.enabled and cfg.regime.use_daily_ema:
        out["daily_ema"] = daily_ema_no_lookahead(out, cfg.regime.ema_daily_period)
    else:
        out["daily_ema"] = float("nan")
    return out


def run_backtest(df: pd.DataFrame, cfg: BotConfig) -> BacktestResult:
    """df: OHLCV DataFrame with DatetimeIndex and open/high/low/close columns."""
    data = prepare_indicators(df, cfg)
    # warm up until ATR (grid geometry needs it) is available
    data = data[data["atr"].notna()]
    if len(data) < 2:
        raise ValueError("not enough data after indicator warmup")

    strategy = GridStrategy(cfg)
    executor = BacktestExecutor(cfg.fees)

    equity_vals: list[float] = []
    trade_rows: list[dict] = []

    for ts, row in data.iterrows():
        candle = Candle(
            ts=int(ts.value // 1_000_000),
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
        )
        snap = Snapshot(
            candle=candle,
            atr=float(row["atr"]) if pd.notna(row["atr"]) else None,
            adx=float(row["adx"]) if pd.notna(row["adx"]) else None,
            daily_ema=float(row["daily_ema"]) if pd.notna(row["daily_ema"]) else None,
        )

        fills = executor.match(candle)
        actions = strategy.step(snap, fills)
        market_fills = executor.apply(actions, candle)
        for f in market_fills:
            strategy.apply_market_fill(f)

        for f in fills + market_fills:
            trade_rows.append(
                {"ts": ts, "side": f.order.side, "price": f.price,
                 "qty": f.qty, "fee": f.fee}
            )
        equity_vals.append(strategy.portfolio.equity(candle.close))

    equity = pd.Series(equity_vals, index=data.index, name="equity")
    trades = pd.DataFrame(trade_rows, columns=["ts", "side", "price", "qty", "fee"])
    return build_result(
        equity=equity,
        trades=trades,
        capital=cfg.capital,
        first_close=float(data["close"].iloc[0]),
        last_close=float(data["close"].iloc[-1]),
        fees_paid=strategy.portfolio.fees_paid,
        recenters=strategy.stats.recenters,
        stop_triggered=strategy.stats.stop_triggered,
        candles_by_status=strategy.stats.candles,
    )
