from pathlib import Path

import pytest

from gridbot.config import load_config

EXAMPLE = Path(__file__).resolve().parents[1] / "configs" / "btcusdt-1h.yaml"


def test_load_example_config():
    cfg = load_config(EXAMPLE)
    assert cfg.symbol == "BTC/USDT"
    assert cfg.grid.n_levels == 6
    assert cfg.fees.fee_pct == pytest.approx(0.001)
    # order sizing: full ladder deployment == max exposure
    assert cfg.order_quote * cfg.grid.n_levels == pytest.approx(
        cfg.capital * cfg.risk.max_exposure_pct
    )


def test_unknown_key_rejected(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text("symbol: BTC/USDT\ntypo_key: 1\n")
    with pytest.raises(ValueError, match="typo_key"):
        load_config(bad)


def test_bad_inventory_policy_rejected(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text("grid:\n  inventory_policy: yolo\n")
    with pytest.raises(ValueError, match="inventory_policy"):
        load_config(bad)
