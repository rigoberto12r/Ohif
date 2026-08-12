"""Backtest result metrics."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class BacktestResult:
    equity: pd.Series  # equity at each candle close, indexed by timestamp
    trades: pd.DataFrame  # columns: ts, side, price, qty, fee
    final_equity: float
    net_pnl: float
    return_pct: float
    max_drawdown_pct: float
    buy_hold_return_pct: float
    n_buys: int
    n_sells: int
    fees_paid: float
    recenters: int
    stop_triggered: bool
    candles_by_status: dict[str, int]

    def summary(self) -> str:
        lines = [
            f"Final equity:      {self.final_equity:,.2f}",
            f"Net PnL:           {self.net_pnl:,.2f} ({self.return_pct:+.2f}%)",
            f"Buy & hold:        {self.buy_hold_return_pct:+.2f}%",
            f"Max drawdown:      {self.max_drawdown_pct:.2f}%",
            f"Trades:            {self.n_buys} buys / {self.n_sells} sells",
            f"Fees paid:         {self.fees_paid:,.2f}",
            f"Recenters:         {self.recenters}",
            f"Global stop hit:   {'YES' if self.stop_triggered else 'no'}",
            "Candles by status: "
            + ", ".join(f"{k}={v}" for k, v in self.candles_by_status.items() if v),
        ]
        return "\n".join(lines)


def max_drawdown_pct(equity: pd.Series) -> float:
    peak = equity.cummax()
    dd = (equity - peak) / peak
    return float(-dd.min() * 100.0) if len(dd) else 0.0


def build_result(
    equity: pd.Series,
    trades: pd.DataFrame,
    capital: float,
    first_close: float,
    last_close: float,
    fees_paid: float,
    recenters: int,
    stop_triggered: bool,
    candles_by_status: dict[str, int],
) -> BacktestResult:
    final = float(equity.iloc[-1]) if len(equity) else capital
    return BacktestResult(
        equity=equity,
        trades=trades,
        final_equity=final,
        net_pnl=final - capital,
        return_pct=(final / capital - 1.0) * 100.0,
        max_drawdown_pct=max_drawdown_pct(equity),
        buy_hold_return_pct=(last_close / first_close - 1.0) * 100.0,
        n_buys=int((trades["side"] == "buy").sum()) if len(trades) else 0,
        n_sells=int((trades["side"] == "sell").sum()) if len(trades) else 0,
        fees_paid=fees_paid,
        recenters=recenters,
        stop_triggered=stop_triggered,
        candles_by_status=candles_by_status,
    )
