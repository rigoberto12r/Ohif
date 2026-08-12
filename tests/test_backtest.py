"""Integration tests on synthetic fixtures: the grid must profit in a range,
the global stop must cap losses in a crash, and fees must drag PnL monotonically.
"""

import numpy as np
import pandas as pd
import pytest

from gridbot.backtest import run_backtest
from gridbot.config import BotConfig, FeesConfig, GridConfig, RegimeConfig, RiskConfig


def make_ohlc(closes, start="2023-01-01", freq="1h"):
    idx = pd.date_range(start, periods=len(closes), freq=freq, tz="UTC")
    close = pd.Series(closes, index=idx, dtype=float)
    open_ = close.shift(1).fillna(close.iloc[0])
    hi = pd.concat([open_, close], axis=1).max(axis=1) * 1.001
    lo = pd.concat([open_, close], axis=1).min(axis=1) * 0.999
    return pd.DataFrame(
        {"open": open_, "high": hi, "low": lo, "close": close, "volume": 1.0}
    )


def sideways_closes(n=3000, base=100.0, amplitude=3.0, period=96):
    t = np.arange(n)
    return base + amplitude * np.sin(2 * np.pi * t / period)


def crash_closes(n=1500, start=100.0, end=45.0):
    t = np.linspace(0, 1, n)
    noise = 0.2 * np.sin(np.arange(n) * 0.7)
    return start + (end - start) * t + noise


def make_cfg(fee_pct=0.001, regime_enabled=False, min_spacing_pct=0.005):
    return BotConfig(
        capital=1000.0,
        grid=GridConfig(
            n_levels=6, min_spacing_pct=min_spacing_pct, recenter_candles=6
        ),
        fees=FeesConfig(fee_pct=fee_pct, slippage_pct=0.0005),
        regime=RegimeConfig(enabled=regime_enabled),
        risk=RiskConfig(max_exposure_pct=0.65, global_stop_pct=0.12),
    )


def test_grid_profits_in_sideways_market():
    df = make_ohlc(sideways_closes())
    result = run_backtest(df, make_cfg())
    assert result.n_buys > 20
    assert result.n_sells > 20
    assert result.fees_paid > 0
    assert result.net_pnl > 0, result.summary()
    assert not result.stop_triggered


def test_global_stop_caps_crash_losses():
    df = make_ohlc(crash_closes())
    result = run_backtest(df, make_cfg())
    assert result.stop_triggered, result.summary()
    # buy & hold loses ~55%; the stop must keep us far above that
    assert result.buy_hold_return_pct < -50
    assert result.return_pct > -20, result.summary()
    assert result.return_pct < 0  # a crash is still a loss, just a bounded one


def test_higher_fees_strictly_reduce_pnl():
    # pin min_spacing above every fee floor so all three runs share the exact
    # same grid geometry and trade path — isolating pure fee drag
    df = make_ohlc(sideways_closes(amplitude=4.0))
    cheap = run_backtest(df, make_cfg(fee_pct=0.0, min_spacing_pct=0.012))
    standard = run_backtest(df, make_cfg(fee_pct=0.001, min_spacing_pct=0.012))
    pricey = run_backtest(df, make_cfg(fee_pct=0.002, min_spacing_pct=0.012))
    assert cheap.n_buys == standard.n_buys == pricey.n_buys
    assert cheap.net_pnl > standard.net_pnl > pricey.net_pnl


def test_regime_filter_reduces_activity_in_trend():
    closes = crash_closes(n=800, start=100.0, end=70.0)
    df = make_ohlc(closes)
    with_filter = run_backtest(df, make_cfg(regime_enabled=True))
    without = run_backtest(df, make_cfg(regime_enabled=False))
    assert with_filter.candles_by_status["paused"] > 0
    assert with_filter.n_buys <= without.n_buys


def test_equity_series_aligned_with_data():
    df = make_ohlc(sideways_closes(n=500))
    result = run_backtest(df, make_cfg())
    assert len(result.equity) == len(result.equity.dropna())
    assert result.equity.index.is_monotonic_increasing
    assert result.final_equity == pytest.approx(float(result.equity.iloc[-1]))
