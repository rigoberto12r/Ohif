"""Spot portfolio accounting: inventory, average cost, realized PnL, fees."""

from __future__ import annotations

from dataclasses import dataclass

_EPS = 1e-12


@dataclass
class Portfolio:
    quote: float
    base: float = 0.0
    avg_cost: float = 0.0
    realized_pnl: float = 0.0
    fees_paid: float = 0.0

    def buy(self, price: float, qty: float, fee: float) -> None:
        cost = price * qty
        if cost + fee > self.quote + _EPS:
            raise ValueError("insufficient quote balance")
        self.quote -= cost + fee
        self.avg_cost = (self.avg_cost * self.base + cost) / (self.base + qty)
        self.base += qty
        self.fees_paid += fee

    def sell(self, price: float, qty: float, fee: float) -> None:
        if qty > self.base + _EPS:
            raise ValueError("insufficient base balance")
        qty = min(qty, self.base)
        self.quote += price * qty - fee
        self.realized_pnl += (price - self.avg_cost) * qty - fee
        self.base -= qty
        self.fees_paid += fee
        if self.base <= _EPS:
            self.base = 0.0
            self.avg_cost = 0.0

    def equity(self, price: float) -> float:
        return self.quote + self.base * price

    def exposure(self, price: float, capital: float) -> float:
        return self.base * price / capital
