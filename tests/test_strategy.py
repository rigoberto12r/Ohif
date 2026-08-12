import pytest

from gridbot.config import BotConfig, GridConfig, RegimeConfig, RiskConfig
from gridbot.strategy import (
    Candle,
    CancelOrder,
    Fill,
    GridStrategy,
    MarketSell,
    PlaceOrder,
    Snapshot,
    Status,
)


def make_cfg(**overrides):
    cfg = BotConfig(
        capital=1000.0,
        grid=GridConfig(n_levels=4, min_spacing_pct=0.01, recenter_candles=3),
        regime=RegimeConfig(enabled=False),
        risk=RiskConfig(max_exposure_pct=0.65, global_stop_pct=0.12),
    )
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


def snap(close, atr=None, adx=None, daily_ema=None, ts=0):
    candle = Candle(ts=ts, open=close, high=close * 1.001, low=close * 0.999, close=close)
    return Snapshot(candle=candle, atr=atr, adx=adx, daily_ema=daily_ema)


def placed(actions, side=None):
    orders = [a.order for a in actions if isinstance(a, PlaceOrder)]
    return [o for o in orders if side is None or o.side == side]


def test_initial_step_places_full_buy_ladder():
    s = GridStrategy(make_cfg())
    actions = s.step(snap(100.0), [])
    buys = placed(actions, "buy")
    assert len(buys) == 4
    assert all(o.price < 100.0 for o in buys)
    # geometric: each level ~1% below the previous
    assert buys[0].price == pytest.approx(100 / 1.01)
    assert buys[3].price == pytest.approx(100 / 1.01**4)
    # ladder sized to hit max exposure when fully deployed
    assert sum(o.price * o.qty for o in buys) == pytest.approx(650.0)


def test_buy_fill_places_paired_sell_one_spacing_above():
    s = GridStrategy(make_cfg())
    actions = s.step(snap(100.0), [])
    buy = placed(actions, "buy")[0]

    fill = Fill(order=buy, price=buy.price, qty=buy.qty, fee=0.16)
    actions = s.step(snap(99.0), [fill])
    sells = placed(actions, "sell")
    assert len(sells) == 1
    assert sells[0].price == pytest.approx(buy.price * 1.01)
    assert sells[0].qty == pytest.approx(buy.qty)
    assert s.portfolio.base == pytest.approx(buy.qty)
    # no duplicate buy re-placed at the held level
    assert all(o.level != buy.level for o in placed(actions, "buy"))


def test_sell_fill_frees_level_and_replenishes_buy():
    s = GridStrategy(make_cfg())
    buy = placed(s.step(snap(100.0), []), "buy")[0]
    sell = placed(
        s.step(snap(99.0), [Fill(order=buy, price=buy.price, qty=buy.qty, fee=0.0)]),
        "sell",
    )[0]

    actions = s.step(
        snap(100.5), [Fill(order=sell, price=sell.price, qty=sell.qty, fee=0.0)]
    )
    rebuys = placed(actions, "buy")
    assert len(rebuys) == 1
    assert rebuys[0].level == buy.level
    assert s.portfolio.base == 0.0
    assert s.portfolio.realized_pnl > 0


def test_global_stop_liquidates_and_halts():
    s = GridStrategy(make_cfg())
    buy = placed(s.step(snap(100.0), []), "buy")[0]
    s.step(snap(99.0), [Fill(order=buy, price=buy.price, qty=buy.qty, fee=0.0)])

    # avg cost ~99; 12% stop sits at ~87.1 — close at 80 must trigger it
    actions = s.step(snap(80.0), [])
    assert s.status is Status.STOPPED
    assert any(isinstance(a, MarketSell) for a in actions)
    cancelled = [a for a in actions if isinstance(a, CancelOrder)]
    assert len(cancelled) >= 3  # remaining buys and the open sell
    assert s.open_orders == {}
    # once stopped, the engine goes inert
    assert s.step(snap(100.0), []) == []


def test_regime_filter_pauses_and_resumes():
    cfg = make_cfg(regime=RegimeConfig(enabled=True, adx_threshold=27.0))
    s = GridStrategy(cfg)
    s.step(snap(100.0, adx=10.0), [])

    actions = s.step(snap(100.0, adx=40.0), [])
    assert s.status is Status.PAUSED
    assert len([a for a in actions if isinstance(a, CancelOrder)]) == 4
    assert placed(actions) == []

    actions = s.step(snap(102.0, adx=10.0), [])
    assert s.status is Status.ACTIVE
    buys = placed(actions, "buy")
    assert len(buys) == 4
    assert s.layout.center == pytest.approx(102.0)  # rebuilt around current price


def test_daily_ema_filter_pauses_below_ema():
    cfg = make_cfg(regime=RegimeConfig(enabled=True, use_daily_ema=True))
    s = GridStrategy(cfg)
    s.step(snap(100.0, daily_ema=90.0), [])
    assert s.status is Status.ACTIVE
    s.step(snap(100.0, daily_ema=110.0), [])
    assert s.status is Status.PAUSED


def test_recenter_after_consecutive_closes_outside_range():
    s = GridStrategy(make_cfg())
    s.step(snap(100.0), [])
    low_bound = s.layout.low_bound  # ~96.1

    s.step(snap(95.0), [])
    s.step(snap(95.0), [])
    assert s.stats.recenters == 0
    actions = s.step(snap(95.0), [])
    assert s.stats.recenters == 1
    assert s.layout.center == pytest.approx(95.0)
    assert s.layout.low_bound < low_bound
    assert len(placed(actions, "buy")) == 4  # fresh ladder below new center


def test_recenter_flush_liquidates_inventory():
    cfg = make_cfg()
    cfg.grid.inventory_policy = "flush"
    s = GridStrategy(cfg)
    buy = placed(s.step(snap(100.0), []), "buy")[0]
    s.step(snap(99.0), [Fill(order=buy, price=buy.price, qty=buy.qty, fee=0.0)])

    s.step(snap(95.0), [])
    s.step(snap(95.0), [])
    actions = s.step(snap(95.0), [])
    assert s.stats.recenters == 1
    assert any(isinstance(a, MarketSell) for a in actions)


def test_recenter_keep_orphans_sells_but_keeps_them_open():
    s = GridStrategy(make_cfg())  # inventory_policy: keep
    buy = placed(s.step(snap(100.0), []), "buy")[0]
    s.step(snap(99.0), [Fill(order=buy, price=buy.price, qty=buy.qty, fee=0.0)])

    s.step(snap(95.0), [])
    s.step(snap(95.0), [])
    actions = s.step(snap(95.0), [])
    assert not any(isinstance(a, MarketSell) for a in actions)
    surviving_sells = [o for o in s.open_orders.values() if o.side == "sell"]
    assert len(surviving_sells) == 1
    assert surviving_sells[0].level is None  # detached from the new grid


def test_exposure_gate_blocks_buys_at_cap():
    s = GridStrategy(make_cfg())
    buys = placed(s.step(snap(100.0), []), "buy")
    fills = [Fill(order=o, price=o.price, qty=o.qty, fee=0.0) for o in buys]
    # all four levels fill; inventory notional ~650 = the 65% cap
    s.step(snap(97.0), fills)
    assert s.portfolio.exposure(97.0, 1000.0) <= 0.66

    # price drifts down (not enough to hit the global stop) until a recenter
    # opens fresh levels — the exposure gate must refuse to average down
    s.step(snap(90.0), [])
    s.step(snap(90.0), [])
    actions = s.step(snap(90.0), [])
    assert s.stats.recenters == 1
    assert placed(actions, "buy") == []
    assert s.status is Status.ACTIVE
