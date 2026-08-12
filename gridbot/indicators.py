"""Technical indicators (Wilder ATR/ADX, EMA) on pandas — no TA-lib dependency."""

from __future__ import annotations

import numpy as np
import pandas as pd


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False, min_periods=period).mean()


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    # Wilder smoothing (alpha = 1/period)
    tr = true_range(df)
    return tr.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)

    alpha = 1.0 / period
    tr_s = true_range(df).ewm(alpha=alpha, adjust=False, min_periods=period).mean()
    plus_s = plus_dm.ewm(alpha=alpha, adjust=False, min_periods=period).mean()
    minus_s = minus_dm.ewm(alpha=alpha, adjust=False, min_periods=period).mean()

    plus_di = 100.0 * plus_s / tr_s
    minus_di = 100.0 * minus_s / tr_s
    di_sum = plus_di + minus_di
    dx = 100.0 * (plus_di - minus_di).abs() / di_sum.replace(0.0, np.nan)
    return dx.ewm(alpha=alpha, adjust=False, min_periods=period).mean()


def daily_ema_no_lookahead(df: pd.DataFrame, period: int = 200) -> pd.Series:
    """EMA of daily closes, shifted one day so each intraday candle only sees
    the EMA of fully closed days, then forward-filled onto df's index.

    Returns NaN (filter inactive) until `period` full days of history exist.
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError("df must have a DatetimeIndex")
    daily_close = df["close"].resample("1D").last().dropna()
    daily = ema(daily_close, period).shift(1)
    return daily.reindex(df.index, method="ffill")
