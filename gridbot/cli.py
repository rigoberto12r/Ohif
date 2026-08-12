"""Command-line interface: fetch-data, backtest."""

from __future__ import annotations

import argparse
import sys

from . import data as data_mod
from .backtest import run_backtest
from .config import load_config


def cmd_fetch_data(args: argparse.Namespace) -> int:
    df = data_mod.fetch_klines(
        args.symbol, args.timeframe, since=args.since, until=args.until,
        exchange_id=args.exchange,
    )
    path = data_mod.cache_path(args.out, args.symbol, args.timeframe)
    data_mod.save_klines(df, path)
    print(f"Saved {len(df)} candles ({df.index[0]} .. {df.index[-1]}) to {path}")
    return 0


def cmd_demo_data(args: argparse.Namespace) -> int:
    df = data_mod.synthetic_klines(n=args.candles, seed=args.seed)
    path = data_mod.cache_path(args.out, "DEMO/USDT", "1h")
    data_mod.save_klines(df, path)
    print(f"Saved {len(df)} synthetic candles to {path} "
          f"(smoke-testing only — not real market data)")
    return 0


def cmd_backtest(args: argparse.Namespace) -> int:
    cfg = load_config(args.config)
    path = args.data or data_mod.cache_path("data", cfg.symbol, cfg.timeframe)
    df = data_mod.load_klines(path)
    if args.since:
        df = df[df.index >= args.since]
    if args.until:
        df = df[df.index < args.until]
    print(f"Backtesting {cfg.symbol} {cfg.timeframe}: {len(df)} candles "
          f"({df.index[0]} .. {df.index[-1]}), capital {cfg.capital:,.2f}\n")
    result = run_backtest(df, cfg)
    print(result.summary())
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="gridbot")
    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch-data", help="download klines to local cache")
    p_fetch.add_argument("--symbol", default="BTC/USDT")
    p_fetch.add_argument("--timeframe", default="1h")
    p_fetch.add_argument("--since", default="2022-01-01")
    p_fetch.add_argument("--until", default=None)
    p_fetch.add_argument("--exchange", default="binance")
    p_fetch.add_argument("--out", default="data")
    p_fetch.set_defaults(func=cmd_fetch_data)

    p_demo = sub.add_parser(
        "demo-data", help="generate synthetic klines for offline smoke tests"
    )
    p_demo.add_argument("--candles", type=int, default=8760)
    p_demo.add_argument("--seed", type=int, default=7)
    p_demo.add_argument("--out", default="data")
    p_demo.set_defaults(func=cmd_demo_data)

    p_bt = sub.add_parser("backtest", help="run a backtest from a YAML config")
    p_bt.add_argument("config")
    p_bt.add_argument("--data", default=None, help="path to cached parquet")
    p_bt.add_argument("--since", default=None)
    p_bt.add_argument("--until", default=None)
    p_bt.set_defaults(func=cmd_backtest)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
