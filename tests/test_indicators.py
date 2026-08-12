import numpy as np
import pandas as pd
import pytest

from gridbot.indicators import adx, atr, daily_ema_no_lookahead, ema


def make_df(closes, highs=None, lows=None, start="2023-01-01"):
    idx = pd.date_range(start, periods=len(closes), freq="1h", tz="UTC")
    closes = pd.Series(closes, index=idx, dtype=float)
    highs = pd.Series(highs, index=idx, dtype=float) if highs is not None else closes + 1
    lows = pd.Series(lows, index=idx, dtype=float) if lows is not None else closes - 1
    return pd.DataFrame(
        {"open": closes.shift(1).fillna(closes.iloc[0]),
         "high": highs, "low": lows, "close": closes}
    )


def test_ema_matches_pandas_and_warmup():
    s = pd.Series(np.linspace(1, 50, 50))
    result = ema(s, 10)
    assert result.iloc[:9].isna().all()
    expected = s.ewm(span=10, adjust=False).mean()
    assert np.allclose(result.iloc[9:], expected.iloc[9:])


def test_atr_constant_range():
    # every candle has TR == 2 and no gaps, so Wilder ATR must be exactly 2
    df = make_df([100.0] * 40, highs=[101.0] * 40, lows=[99.0] * 40)
    result = atr(df, 14).dropna()
    assert len(result) > 0
    assert np.allclose(result, 2.0)


def test_adx_high_in_trend_low_in_chop():
    trend_closes = [100.0 * 1.01**i for i in range(80)]
    trend = make_df(trend_closes)
    assert adx(trend, 14).iloc[-1] > 30

    chop_closes = [100.0 if i % 2 == 0 else 100.5 for i in range(80)]
    chop = make_df(chop_closes)
    assert adx(chop, 14).iloc[-1] < 20


def test_daily_ema_no_lookahead_uses_previous_day():
    closes = [100.0] * 24 + [110.0] * 24 + [120.0] * 24
    df = make_df(closes)
    result = daily_ema_no_lookahead(df, period=2)

    daily_closes = df["close"].resample("1D").last()
    expected_day3 = ema(daily_closes, 2).iloc[1]  # EMA through day 2 only
    day3 = result[result.index.normalize() == result.index.normalize()[-1]]
    assert np.allclose(day3.dropna(), expected_day3)
    # day 1 and 2 have no valid (shifted) EMA yet
    assert result.iloc[:24].isna().all()


def test_daily_ema_requires_datetime_index():
    df = pd.DataFrame({"close": [1.0, 2.0]})
    with pytest.raises(ValueError):
        daily_ema_no_lookahead(df, 2)
