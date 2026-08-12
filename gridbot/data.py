"""Historical kline download and caching (Binance via ccxt, public endpoints)."""

from __future__ import annotations

import time
from pathlib import Path

import pandas as pd

COLUMNS = ["open", "high", "low", "close", "volume"]


def cache_path(data_dir: str | Path, symbol: str, timeframe: str) -> Path:
    name = symbol.replace("/", "") + f"-{timeframe}.parquet"
    return Path(data_dir) / name


def fetch_klines(
    symbol: str,
    timeframe: str = "1h",
    since: str = "2022-01-01",
    until: str | None = None,
    exchange_id: str = "binance",
) -> pd.DataFrame:
    """Download OHLCV paginated from the exchange's public API (no key needed)."""
    import ccxt  # imported lazily so backtests on cached data need no network

    exchange = getattr(ccxt, exchange_id)({"enableRateLimit": True})
    since_ms = int(pd.Timestamp(since, tz="UTC").timestamp() * 1000)
    until_ms = (
        int(pd.Timestamp(until, tz="UTC").timestamp() * 1000)
        if until
        else int(time.time() * 1000)
    )

    rows: list[list] = []
    cursor = since_ms
    tf_ms = exchange.parse_timeframe(timeframe) * 1000
    while cursor < until_ms:
        batch = exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=1000)
        if not batch:
            break
        rows.extend(batch)
        cursor = batch[-1][0] + tf_ms
        if len(batch) < 2:
            break

    if not rows:
        raise RuntimeError(f"no klines returned for {symbol} {timeframe}")

    df = pd.DataFrame(rows, columns=["ts", *COLUMNS])
    df = df.drop_duplicates(subset="ts").sort_values("ts")
    df = df[df["ts"] < until_ms]
    df.index = pd.to_datetime(df.pop("ts"), unit="ms", utc=True)
    df.index.name = "ts"
    return df.astype(float)


def synthetic_klines(
    n: int = 8760,
    start: str = "2023-01-01",
    freq: str = "1h",
    price0: float = 30_000.0,
    seed: int = 7,
) -> pd.DataFrame:
    """Seeded synthetic OHLCV (geometric random walk with a slow cycle).

    For smoke-testing the pipeline offline — NOT a substitute for real data.
    """
    import numpy as np

    rng = np.random.default_rng(seed)
    t = np.arange(n)
    drift = 0.00003 * np.sin(2 * np.pi * t / (24 * 90))  # slow regime cycle
    vol = 0.006 * (1.0 + 0.5 * np.sin(2 * np.pi * t / (24 * 30)))
    returns = drift + rng.normal(0.0, 1.0, n) * vol
    close = price0 * np.exp(np.cumsum(returns))

    idx = pd.date_range(start, periods=n, freq=freq, tz="UTC")
    close_s = pd.Series(close, index=idx)
    open_s = close_s.shift(1).fillna(close_s.iloc[0])
    wiggle = np.abs(rng.normal(0.0, 0.002, n))
    hi = pd.concat([open_s, close_s], axis=1).max(axis=1) * (1.0 + wiggle)
    lo = pd.concat([open_s, close_s], axis=1).min(axis=1) * (1.0 - wiggle)
    df = pd.DataFrame(
        {"open": open_s, "high": hi, "low": lo, "close": close_s, "volume": 1.0}
    )
    df.index.name = "ts"
    return df


def save_klines(df: pd.DataFrame, path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path)


def load_klines(path: str | Path) -> pd.DataFrame:
    df = pd.read_parquet(path)
    if not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError(f"{path} does not contain a DatetimeIndex")
    return df
