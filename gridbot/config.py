"""Configuration dataclasses and YAML loading."""

from __future__ import annotations

from dataclasses import dataclass, field, fields
from pathlib import Path

import yaml


@dataclass
class GridConfig:
    n_levels: int = 6  # buy levels below center
    atr_period: int = 14
    atr_mult: float = 1.0
    min_spacing_pct: float = 0.005  # absolute floor for level spacing (fraction)
    recenter_candles: int = 6  # consecutive closes outside range before recentering
    inventory_policy: str = "keep"  # "keep" | "flush" on recenter


@dataclass
class FeesConfig:
    fee_pct: float = 0.001  # per side, taken in quote
    slippage_pct: float = 0.0005  # applied against us on every fill

    @property
    def spacing_floor(self) -> float:
        # spacing must cover a round trip (2 fees) plus slippage, twice over,
        # or the grid trades at a structural loss
        return 2.0 * (2.0 * self.fee_pct + self.slippage_pct)


@dataclass
class RegimeConfig:
    enabled: bool = True
    adx_period: int = 14
    adx_threshold: float = 27.0
    use_daily_ema: bool = True
    ema_daily_period: int = 200


@dataclass
class RiskConfig:
    max_exposure_pct: float = 0.65  # max fraction of capital held as inventory
    global_stop_pct: float = 0.12  # liquidate if price falls this far below avg cost


@dataclass
class BotConfig:
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    capital: float = 1000.0
    grid: GridConfig = field(default_factory=GridConfig)
    fees: FeesConfig = field(default_factory=FeesConfig)
    regime: RegimeConfig = field(default_factory=RegimeConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)

    @property
    def order_quote(self) -> float:
        # size buys so a fully deployed ladder lands at max exposure
        return self.capital * self.risk.max_exposure_pct / self.grid.n_levels


def _build(cls, data: dict):
    known = {f.name: f for f in fields(cls)}
    unknown = set(data) - set(known)
    if unknown:
        raise ValueError(f"Unknown {cls.__name__} keys: {sorted(unknown)}")
    kwargs = {}
    for name, value in data.items():
        ftype = known[name].type
        if isinstance(value, dict):
            sub = {"grid": GridConfig, "fees": FeesConfig,
                   "regime": RegimeConfig, "risk": RiskConfig}[name]
            kwargs[name] = _build(sub, value)
        else:
            kwargs[name] = value
    return cls(**kwargs)


def load_config(path: str | Path) -> BotConfig:
    raw = yaml.safe_load(Path(path).read_text()) or {}
    cfg = _build(BotConfig, raw)
    if cfg.grid.inventory_policy not in ("keep", "flush"):
        raise ValueError("grid.inventory_policy must be 'keep' or 'flush'")
    if cfg.capital <= 0:
        raise ValueError("capital must be positive")
    return cfg
