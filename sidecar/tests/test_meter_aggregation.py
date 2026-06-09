from typing import Any

from polar.meter.aggregation import (
    AggregationFunction,
    AggregationTypeAdapter,
    CountAggregation,
    PropertyAggregation,
    UniqueAggregation,
)
from polar.meter.event import BufferedEvent


def _event(**metadata: Any) -> BufferedEvent:
    return BufferedEvent.from_body(
        {
            "name": "usage",
            "timestamp": "2026-06-09T10:00:00+00:00",
            "metadata": metadata,
        }
    )


def test_count_is_summable_and_always_matches() -> None:
    aggregation = CountAggregation()
    assert aggregation.is_summable() is True
    assert aggregation.matches(_event()) is True


def test_only_sum_is_summable() -> None:
    summable = PropertyAggregation(func=AggregationFunction.sum, property="tokens")
    assert summable.is_summable() is True

    for func in (
        AggregationFunction.max,
        AggregationFunction.min,
        AggregationFunction.avg,
    ):
        assert PropertyAggregation(func=func, property="tokens").is_summable() is False


def test_unique_is_not_summable() -> None:
    assert UniqueAggregation(property="user_id").is_summable() is False


def test_property_matches_requires_numeric_metadata() -> None:
    aggregation = PropertyAggregation(func=AggregationFunction.sum, property="tokens")
    assert aggregation.matches(_event(tokens=5)) is True
    assert aggregation.matches(_event(tokens=1.5)) is True
    assert aggregation.matches(_event(tokens="five")) is False
    assert aggregation.matches(_event()) is False


def test_type_adapter_discriminates_on_func() -> None:
    assert isinstance(
        AggregationTypeAdapter.validate_python({"func": "count"}), CountAggregation
    )
    assert isinstance(
        AggregationTypeAdapter.validate_python({"func": "sum", "property": "tokens"}),
        PropertyAggregation,
    )
    assert isinstance(
        AggregationTypeAdapter.validate_python(
            {"func": "unique", "property": "user_id"}
        ),
        UniqueAggregation,
    )
