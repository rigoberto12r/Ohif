import pytest

from gridbot.config import FeesConfig
from gridbot.grid import build_layout, compute_spacing


def test_spacing_uses_atr_when_above_floor():
    # ATR of 2 on price 100 with mult 1 -> 2%
    assert compute_spacing(2.0, 100.0, 1.0, floor=0.005) == pytest.approx(0.02)


def test_spacing_respects_floor():
    assert compute_spacing(0.1, 100.0, 1.0, floor=0.005) == pytest.approx(0.005)
    assert compute_spacing(0.0, 100.0, 1.0, floor=0.005) == pytest.approx(0.005)


def test_fee_floor_scales_with_fees():
    cheap = FeesConfig(fee_pct=0.001, slippage_pct=0.0005)
    pricey = FeesConfig(fee_pct=0.005, slippage_pct=0.0005)
    assert pricey.spacing_floor > cheap.spacing_floor
    # a round trip (2 fees + slippage) must fit inside half the spacing
    assert cheap.spacing_floor >= 2 * (2 * cheap.fee_pct + cheap.slippage_pct)


def test_layout_geometry():
    layout = build_layout(center=100.0, spacing=0.01, n_levels=3)
    assert layout.buy_prices == pytest.approx(
        (100 / 1.01, 100 / 1.01**2, 100 / 1.01**3)
    )
    assert layout.low_bound == pytest.approx(min(layout.buy_prices))
    assert layout.high_bound == pytest.approx(100 * 1.01**3)
    # each level's take-profit sits exactly one spacing above its buy
    buy = layout.buy_prices[1]
    assert layout.sell_price_for(buy) == pytest.approx(buy * 1.01)


def test_layout_rejects_bad_inputs():
    with pytest.raises(ValueError):
        build_layout(0.0, 0.01, 3)
    with pytest.raises(ValueError):
        build_layout(100.0, 0.01, 0)
