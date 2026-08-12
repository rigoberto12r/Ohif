"""Pessimistic simulated executor.

Fill model (deliberately conservative):
- A limit buy at P fills only if the candle's low goes strictly below P, and
  fills at P plus slippage (never at a better price, even on a gap down).
- A limit sell at P fills only if the candle's high goes strictly above P,
  and fills at P minus slippage.
- Market sells fill at the candle close minus slippage.
- Fees are charged on every fill, in quote.
- Partial fills are not modeled (all-or-nothing per level) — a documented v1
  simplification.
- Orders placed on candle T can only fill from candle T+1 onward, so profits
  never compound within a single candle.
"""

from __future__ import annotations

from ..config import FeesConfig
from ..strategy import (
    Action,
    Candle,
    CancelOrder,
    Fill,
    MarketSell,
    Order,
    PlaceOrder,
)
from . import Executor


class BacktestExecutor(Executor):
    def __init__(self, fees: FeesConfig):
        self.fees = fees
        self.open_orders: dict[str, Order] = {}

    def match(self, candle: Candle) -> list[Fill]:
        fills: list[Fill] = []
        for order in list(self.open_orders.values()):
            if order.side == "buy" and candle.low < order.price:
                price = order.price * (1.0 + self.fees.slippage_pct)
            elif order.side == "sell" and candle.high > order.price:
                price = order.price * (1.0 - self.fees.slippage_pct)
            else:
                continue
            del self.open_orders[order.id]
            fee = price * order.qty * self.fees.fee_pct
            fills.append(Fill(order=order, price=price, qty=order.qty, fee=fee))
        return fills

    def apply(self, actions: list[Action], candle: Candle) -> list[Fill]:
        market_fills: list[Fill] = []
        for action in actions:
            if isinstance(action, PlaceOrder):
                self.open_orders[action.order.id] = action.order
            elif isinstance(action, CancelOrder):
                self.open_orders.pop(action.order_id, None)
            elif isinstance(action, MarketSell):
                if action.qty <= 0:
                    continue
                price = candle.close * (1.0 - self.fees.slippage_pct)
                fee = price * action.qty * self.fees.fee_pct
                order = Order(id="market", side="sell", price=price,
                              qty=action.qty, level=None)
                market_fills.append(
                    Fill(order=order, price=price, qty=action.qty, fee=fee)
                )
        return market_fills
