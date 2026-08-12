import pytest

from gridbot.portfolio import Portfolio


def test_buy_updates_avg_cost_and_balances():
    pf = Portfolio(quote=1000.0)
    pf.buy(price=100.0, qty=2.0, fee=0.2)
    pf.buy(price=90.0, qty=2.0, fee=0.18)
    assert pf.base == pytest.approx(4.0)
    assert pf.avg_cost == pytest.approx(95.0)
    assert pf.quote == pytest.approx(1000 - 200 - 0.2 - 180 - 0.18)
    assert pf.fees_paid == pytest.approx(0.38)


def test_sell_realizes_pnl_and_resets_when_flat():
    pf = Portfolio(quote=1000.0)
    pf.buy(price=100.0, qty=2.0, fee=0.0)
    pf.sell(price=110.0, qty=1.0, fee=0.11)
    assert pf.realized_pnl == pytest.approx(10.0 - 0.11)
    assert pf.base == pytest.approx(1.0)
    assert pf.avg_cost == pytest.approx(100.0)

    pf.sell(price=90.0, qty=1.0, fee=0.0)
    assert pf.base == 0.0
    assert pf.avg_cost == 0.0
    assert pf.realized_pnl == pytest.approx(10.0 - 0.11 - 10.0)


def test_equity_and_exposure():
    pf = Portfolio(quote=500.0)
    pf.buy(price=100.0, qty=3.0, fee=0.0)
    assert pf.equity(price=110.0) == pytest.approx(200.0 + 330.0)
    assert pf.exposure(price=100.0, capital=1000.0) == pytest.approx(0.3)


def test_overdraft_rejected():
    pf = Portfolio(quote=100.0)
    with pytest.raises(ValueError):
        pf.buy(price=100.0, qty=2.0, fee=0.0)
    with pytest.raises(ValueError):
        pf.sell(price=100.0, qty=1.0, fee=0.0)
