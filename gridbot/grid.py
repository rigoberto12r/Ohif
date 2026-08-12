"""Grid geometry: geometric level layout and adaptive spacing."""

from __future__ import annotations

from dataclasses import dataclass


def compute_spacing(atr_value: float, price: float, atr_mult: float, floor: float) -> float:
    """Level spacing as a fraction of price: k*ATR, never below the fee floor."""
    if price <= 0:
        raise ValueError("price must be positive")
    adaptive = atr_mult * atr_value / price if atr_value and atr_value > 0 else 0.0
    return max(adaptive, floor)


@dataclass(frozen=True)
class GridLayout:
    center: float
    spacing: float  # fraction between adjacent levels
    buy_prices: tuple[float, ...]  # descending, nearest-to-center first
    low_bound: float
    high_bound: float

    def sell_price_for(self, buy_price: float) -> float:
        return buy_price * (1.0 + self.spacing)


def build_layout(center: float, spacing: float, n_levels: int) -> GridLayout:
    if center <= 0 or spacing <= 0 or n_levels < 1:
        raise ValueError("center/spacing/n_levels must be positive")
    step = 1.0 + spacing
    buys = tuple(center / step**i for i in range(1, n_levels + 1))
    return GridLayout(
        center=center,
        spacing=spacing,
        buy_prices=buys,
        low_bound=buys[-1],
        high_bound=center * step**n_levels,
    )
