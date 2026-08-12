"""Grid strategy engine.

Pure state machine: consumes closed candles (with precomputed indicators) plus
fill events, emits order intents. No I/O, no clock, no exchange — the same
engine runs under the backtest executor today and a live executor later.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass, field

from .config import BotConfig
from .grid import GridLayout, build_layout, compute_spacing
from .portfolio import Portfolio


@dataclass(frozen=True)
class Candle:
    ts: int  # epoch ms
    open: float
    high: float
    low: float
    close: float


@dataclass(frozen=True)
class Snapshot:
    """A closed candle plus indicator values computed up to that candle."""

    candle: Candle
    atr: float | None
    adx: float | None
    daily_ema: float | None


@dataclass(frozen=True)
class Order:
    id: str
    side: str  # "buy" | "sell"
    price: float
    qty: float
    level: int | None  # grid level index; None for orphaned (pre-recenter) sells


@dataclass(frozen=True)
class Fill:
    order: Order
    price: float  # actual fill price (slippage included)
    qty: float
    fee: float  # in quote


# --- actions the engine emits ---


@dataclass(frozen=True)
class PlaceOrder:
    order: Order


@dataclass(frozen=True)
class CancelOrder:
    order_id: str


@dataclass(frozen=True)
class MarketSell:
    qty: float


Action = PlaceOrder | CancelOrder | MarketSell


class Status(enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    STOPPED = "stopped"


class _Level(enum.Enum):
    FREE = "free"
    BUY_OPEN = "buy_open"
    HOLDING = "holding"  # bought; paired sell is open


@dataclass
class Stats:
    recenters: int = 0
    stop_triggered: bool = False
    candles: dict[str, int] = field(default_factory=lambda: {s.value: 0 for s in Status})


class GridStrategy:
    def __init__(self, cfg: BotConfig):
        self.cfg = cfg
        self.portfolio = Portfolio(quote=cfg.capital)
        self.status = Status.ACTIVE
        self.layout: GridLayout | None = None
        self.level_state: list[_Level] = []
        self.open_orders: dict[str, Order] = {}
        self.outside_count = 0
        self.stats = Stats()
        self._next_id = 0

    # --- public API ---

    def step(self, snap: Snapshot, fills: list[Fill]) -> list[Action]:
        actions: list[Action] = []
        close = snap.candle.close
        self.stats.candles[self.status.value] += 1

        self._process_fills(fills, actions)

        if self.status is Status.STOPPED:
            return actions

        if self.layout is None:
            self._rebuild_grid(snap)

        if self._check_global_stop(close, actions):
            return actions

        self._check_regime(snap, actions)

        if self.status is Status.ACTIVE:
            self._check_recenter(snap, actions)
            self._replenish_buys(close, actions)

        return actions

    def apply_market_fill(self, fill: Fill) -> None:
        """Account for an immediately executed market sell (liquidation)."""
        self.portfolio.sell(fill.price, fill.qty, fill.fee)

    # --- fill handling ---

    def _process_fills(self, fills: list[Fill], actions: list[Action]) -> None:
        for fill in fills:
            order = fill.order
            self.open_orders.pop(order.id, None)
            if order.side == "buy":
                self.portfolio.buy(fill.price, fill.qty, fill.fee)
                if self.status is Status.STOPPED or self.layout is None:
                    continue
                if order.level is not None:
                    self.level_state[order.level] = _Level.HOLDING
                sell = self._new_order(
                    "sell", order.price * (1.0 + self.layout.spacing), fill.qty, order.level
                )
                self.open_orders[sell.id] = sell
                actions.append(PlaceOrder(sell))
            else:
                self.portfolio.sell(fill.price, fill.qty, fill.fee)
                if order.level is not None and self.layout is not None:
                    if 0 <= order.level < len(self.level_state):
                        self.level_state[order.level] = _Level.FREE

    # --- risk ---

    def _check_global_stop(self, close: float, actions: list[Action]) -> bool:
        stop = self.cfg.risk.global_stop_pct
        pf = self.portfolio
        if pf.base > 0 and close < pf.avg_cost * (1.0 - stop):
            for oid in list(self.open_orders):
                actions.append(CancelOrder(oid))
            self.open_orders.clear()
            actions.append(MarketSell(pf.base))
            self.status = Status.STOPPED
            self.stats.stop_triggered = True
            return True
        return False

    # --- regime filter ---

    def _regime_bad(self, snap: Snapshot) -> bool:
        r = self.cfg.regime
        if not r.enabled:
            return False
        if snap.adx is not None and snap.adx > r.adx_threshold:
            return True
        if r.use_daily_ema and snap.daily_ema is not None:
            if snap.candle.close < snap.daily_ema:
                return True
        return False

    def _check_regime(self, snap: Snapshot, actions: list[Action]) -> None:
        bad = self._regime_bad(snap)
        if bad and self.status is Status.ACTIVE:
            self.status = Status.PAUSED
            self._cancel_buys(actions)
        elif not bad and self.status is Status.PAUSED:
            self.status = Status.ACTIVE
            # rebuild around current price; open sells are kept (they unload
            # inventory bought before the pause) but detached from the new grid
            self._rebuild_grid(snap)

    # --- recentering ---

    def _check_recenter(self, snap: Snapshot, actions: list[Action]) -> None:
        assert self.layout is not None
        close = snap.candle.close
        if close < self.layout.low_bound or close > self.layout.high_bound:
            self.outside_count += 1
        else:
            self.outside_count = 0
        if self.outside_count < self.cfg.grid.recenter_candles:
            return

        self._cancel_buys(actions)
        if self.cfg.grid.inventory_policy == "flush":
            for oid, order in list(self.open_orders.items()):
                if order.side == "sell":
                    actions.append(CancelOrder(oid))
                    del self.open_orders[oid]
            if self.portfolio.base > 0:
                actions.append(MarketSell(self.portfolio.base))
        self._rebuild_grid(snap)
        self.stats.recenters += 1

    def _rebuild_grid(self, snap: Snapshot) -> None:
        cfg = self.cfg
        spacing = compute_spacing(
            snap.atr or 0.0,
            snap.candle.close,
            cfg.grid.atr_mult,
            max(cfg.grid.min_spacing_pct, cfg.fees.spacing_floor),
        )
        self.layout = build_layout(snap.candle.close, spacing, cfg.grid.n_levels)
        self.level_state = [_Level.FREE] * cfg.grid.n_levels
        self.outside_count = 0
        # sells surviving from a previous grid no longer map to these levels
        self.open_orders = {
            oid: (Order(o.id, o.side, o.price, o.qty, None) if o.side == "sell" else o)
            for oid, o in self.open_orders.items()
        }

    # --- order management ---

    def _cancel_buys(self, actions: list[Action]) -> None:
        for oid, order in list(self.open_orders.items()):
            if order.side == "buy":
                actions.append(CancelOrder(oid))
                del self.open_orders[oid]
                if order.level is not None and 0 <= order.level < len(self.level_state):
                    self.level_state[order.level] = _Level.FREE

    def _replenish_buys(self, close: float, actions: list[Action]) -> None:
        assert self.layout is not None
        cfg = self.cfg
        pending_cost = sum(
            o.price * o.qty for o in self.open_orders.values() if o.side == "buy"
        )
        for level, price in enumerate(self.layout.buy_prices):
            if self.level_state[level] is not _Level.FREE:
                continue
            if price >= close:  # never bid above the market
                continue
            order_cost = cfg.order_quote
            projected_exposure = (
                self.portfolio.base * close + pending_cost + order_cost
            ) / cfg.capital
            if projected_exposure > cfg.risk.max_exposure_pct + 1e-9:
                continue
            # worst-case cash need: every pending buy fills with slippage + fee
            worst = (1.0 + cfg.fees.slippage_pct) * (1.0 + cfg.fees.fee_pct)
            if self.portfolio.quote < (pending_cost + order_cost) * worst:
                continue
            qty = order_cost / price
            order = self._new_order("buy", price, qty, level)
            self.open_orders[order.id] = order
            self.level_state[level] = _Level.BUY_OPEN
            pending_cost += order_cost
            actions.append(PlaceOrder(order))

    def _new_order(self, side: str, price: float, qty: float, level: int | None) -> Order:
        self._next_id += 1
        return Order(id=f"o{self._next_id}", side=side, price=price, qty=qty, level=level)
