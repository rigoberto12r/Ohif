"""Order executors. The strategy engine only emits intents; an executor turns
them into (simulated or real) exchange operations."""

from __future__ import annotations

import abc

from ..strategy import Action, Candle, Fill


class Executor(abc.ABC):
    @abc.abstractmethod
    def match(self, candle: Candle) -> list[Fill]:
        """Fills produced by resting limit orders during this candle."""

    @abc.abstractmethod
    def apply(self, actions: list[Action], candle: Candle) -> list[Fill]:
        """Execute strategy actions; returns immediate (market) fills."""
