from decimal import Decimal
from typing import Any

import pytest
from pydantic import ValidationError

from polar.void.deploy.schemas import DeployCreate


def config(**overrides: Any) -> DeployCreate:
    return DeployCreate.model_validate(
        {
            "checksum": "client-fingerprint",
            "meters": [{"slug": "tokens", "reducer": "usage", "unit_amount": 1}],
            **overrides,
        }
    )


def test_version_is_a_hash_of_config_not_a_user_supplied_name() -> None:
    version = config().version_id
    assert version == "278fca1ee35c8e8e46c470ab969ee8c5820520a95c5eaa6a7497609a8127f848"
    with pytest.raises(ValidationError):
        config(version_id="candidate")
    assert config(checksum="different-request").version_id == version
    assert config(activate=True).version_id == version
    assert (
        config(
            dry_run=True, preview={"start": "2026-01-01", "end": "2026-02-01"}
        ).version_id
        == version
    )


def test_prices_and_reducer_definitions_change_the_version() -> None:
    baseline = config()
    changed = baseline.model_copy(deep=True)
    changed.meters[0].unit_amount = Decimal(2)
    assert changed.version_id != baseline.version_id
    assert (
        config(
            reducers=[
                {
                    "slug": "usage",
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": "count"},
                }
            ]
        ).version_id
        != baseline.version_id
    )


def test_definition_order_defaults_and_decimal_spelling_do_not_change_the_hash() -> (
    None
):
    meters = [
        {"slug": "tokens", "reducer": "usage", "unit_amount": "1.00"},
        {"slug": "calls", "reducer": "count", "unit_amount": "0.010"},
    ]
    first = config(meters=meters)
    second = config(
        meters=[
            {**meters[1], "unit_amount": "0.01", "currency": "usd"},
            {**meters[0], "unit_amount": 1, "credit_reducer": None},
        ]
    )
    assert first.version_id == second.version_id


def test_empty_activities_do_not_change_the_hash() -> None:
    baseline = config()
    assert config(activities=[]).version_id == baseline.version_id
    labeled = config(
        activities=[{"slug": "agent", "event": "llm.completion", "group_by": "call_id"}]
    )
    assert labeled.version_id != baseline.version_id
    assert (
        config(
            activities=[
                {
                    "slug": "agent",
                    "event": "llm.completion",
                    "group_by": "call_id",
                    "run_by": None,
                    "taxonomy": "polar.agent/v1",
                }
            ]
        ).version_id
        == labeled.version_id
    )


def test_product_meter_terms_hash_by_slug_regardless_of_order() -> None:
    product = {
        "slug": "pro",
        "name": "Pro",
        "price": {
            "type": "recurring",
            "interval": "month",
            "amount": 10,
            "currency": "usd",
        },
    }
    terms = {"slug": "tokens", "included": 1000, "limit": "hard", "rollover_cap": 0}
    forward = config(products=[{**product, "meters": ["calls", terms]}]).version_id
    backward = config(products=[{**product, "meters": [terms, "calls"]}]).version_id
    assert forward == backward
    assert (
        forward
        != config(products=[{**product, "meters": ["calls", "tokens"]}]).version_id
    )


def _meter_signal(**overrides: Any) -> dict[str, Any]:
    return {
        "slug": "low-balance",
        "kind": "meter",
        "meter": "tokens",
        "enter_below": 100,
        "exit_at_least": 500,
        **overrides,
    }


def _semantic_signal(**overrides: Any) -> dict[str, Any]:
    return {
        "slug": "abuse",
        "kind": "semantic",
        "meter": "tokens",
        "when": "Is this identity abusing the service?",
        "enter_above": 0.8,
        "exit_below": 0.4,
        **overrides,
    }


def test_empty_signals_do_not_change_the_hash() -> None:
    baseline = config()
    assert config(signals=[]).version_id == baseline.version_id


def test_signals_change_the_version() -> None:
    baseline = config()
    assert config(signals=[_meter_signal()]).version_id != baseline.version_id
    assert config(signals=[_semantic_signal()]).version_id != baseline.version_id


def test_signal_order_does_not_change_the_hash() -> None:
    forward = config(signals=[_meter_signal(), _semantic_signal()]).version_id
    backward = config(signals=[_semantic_signal(), _meter_signal()]).version_id
    assert forward == backward


def test_semantic_default_window_does_not_change_the_hash() -> None:
    implicit = config(signals=[_semantic_signal()]).version_id
    explicit = config(
        signals=[_semantic_signal(over={"amount": 1, "unit": "hour"})]
    ).version_id
    assert implicit == explicit
    assert (
        config(signals=[_semantic_signal(over={"amount": 2, "unit": "day"})]).version_id
        != implicit
    )


def test_signal_thresholds_are_validated() -> None:
    with pytest.raises(ValidationError):
        config(signals=[_meter_signal(enter_below=500, exit_at_least=100)])
    with pytest.raises(ValidationError):
        config(signals=[_semantic_signal(enter_above=0.4, exit_below=0.8)])
    with pytest.raises(ValidationError):
        config(signals=[_semantic_signal(enter_above=1.5)])
