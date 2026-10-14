import datetime

import pytest

from polar.outpost.event import Event
from polar.outpost.reducer import (
    BUCKET_SIZE,
    BucketStatistics,
    FilterClause,
    Reducer,
    get_bucket_start,
    get_matcher,
    reduce,
)

TIMESTAMP = datetime.datetime(2026, 10, 12, 12, 4, 59, tzinfo=datetime.UTC)


@pytest.mark.parametrize(
    ("func", "expected"),
    [("count", 3), ("sum", -2), ("min", -5), ("max", 3), ("avg", -2 / 3)],
)
def test_reduce_buckets(func: str, expected: float) -> None:
    reducer = {
        "id": "usage",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": func, "property": "tokens"},
    }
    events = [
        Event("call", "customer", TIMESTAMP, {"tokens": value}) for value in [-5, 0, 3]
    ]
    events.append(Event("call", "other", TIMESTAMP, {"tokens": 2}))
    events.append(
        Event(
            "call", "customer", TIMESTAMP + datetime.timedelta(seconds=1), {"tokens": 4}
        )
    )
    events.append(
        Event(
            "call",
            "customer",
            TIMESTAMP - datetime.timedelta(minutes=5),
            {"tokens": 99},
        )
    )
    bucket_start = get_bucket_start(TIMESTAMP)

    updates = reduce(
        [(reducer, get_matcher(reducer["filter"]))],
        events,
        oldest_bucket_start=bucket_start,
    )

    assert updates == {
        ("customer", "usage", bucket_start): BucketStatistics(count=3)
        if func == "count"
        else BucketStatistics(count=3, sum=-2, min=-5, max=3),
        ("other", "usage", bucket_start): BucketStatistics(count=1)
        if func == "count"
        else BucketStatistics(count=1, sum=2, min=2, max=2),
        ("customer", "usage", bucket_start + BUCKET_SIZE): BucketStatistics(count=1)
        if func == "count"
        else BucketStatistics(count=1, sum=4, min=4, max=4),
    }
    assert updates[("customer", "usage", bucket_start)].quantity(func) == expected


@pytest.mark.parametrize("func", ["count", "sum", "min", "max", "avg"])
def test_empty_statistics(func: str) -> None:
    assert BucketStatistics().quantity(func) == 0


def test_nested_configuration_and_metadata() -> None:
    reducer = deserialize(
        {
            "id": "tokens",
            "meter_ids": ["meter"],
            "filter": {
                "conjunction": "and",
                "clauses": [
                    {"property": "name", "operator": "eq", "value": "call"},
                    {
                        "conjunction": "or",
                        "clauses": [
                            {
                                "property": "metadata.llm.tokens",
                                "operator": "gte",
                                "value": 2,
                            },
                            {"property": "source", "operator": "eq", "value": "system"},
                        ],
                    },
                ],
            },
            "aggregation": {"func": "sum", "property": "llm.tokens"},
        },
        Reducer,
    )
    matcher = get_matcher(reducer["filter"])
    assert matcher(Event("call", "customer", TIMESTAMP, {"llm": {"tokens": 2}}))
    assert not matcher(Event("call", "customer", TIMESTAMP, {"llm": {"tokens": True}}))
    assert not matcher(Event("other", "customer", TIMESTAMP, {"llm": {"tokens": 2}}))
    assert not matcher(Event("call", "customer", TIMESTAMP))


@pytest.mark.parametrize("operator", ["eq", "ne"])
@pytest.mark.parametrize(
    ("actual", "expected", "equal"),
    [
        (True, 1, True),
        (1, True, True),
        (False, 0, True),
        (0, False, True),
        (True, 1.0, True),
        (True, 2, False),
        (False, 1, False),
        ("1", 1, False),
    ],
)
def test_equality_filters_use_operand_values(
    operator: str,
    actual: str | float | bool,
    expected: str | float | bool,
    equal: bool,
) -> None:
    clause = deserialize(
        {"property": "value", "operator": operator, "value": expected}, FilterClause
    )
    assert get_matcher(clause)(
        Event("call", "customer", TIMESTAMP, {"value": actual})
    ) is (equal if operator == "eq" else not equal)


@pytest.mark.parametrize("value", [True, "5", None])
def test_non_numeric_aggregation_is_skipped(value: object) -> None:
    reducer: Reducer = {
        "id": "tokens",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "tokens"},
    }
    assert (
        reduce(
            [(reducer, get_matcher(reducer["filter"]))],
            [Event("call", "customer", TIMESTAMP, {"tokens": value})],
            oldest_bucket_start=0,
        )
        == {}
    )


@pytest.mark.parametrize("values", [[float("nan")], [float("inf")], [1e308, 1e308]])
def test_non_finite_aggregation_is_rejected(values: list[float]) -> None:
    reducer: Reducer = {
        "id": "tokens",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "tokens"},
    }
    with pytest.raises(ValueError, match="finite"):
        reduce(
            [(reducer, get_matcher(reducer["filter"]))],
            [
                Event("call", "customer", TIMESTAMP, {"tokens": value})
                for value in values
            ],
            oldest_bucket_start=0,
        )


@pytest.mark.parametrize(
    ("timestamp", "expected"),
    [
        ("1970-01-01T00:04:59.999999Z", 0),
        ("1970-01-01T00:05:00Z", BUCKET_SIZE),
        ("1969-12-31T23:59:59.999999Z", -BUCKET_SIZE),
    ],
)
def test_bucket_boundaries_in_microseconds(timestamp: str, expected: int) -> None:
    assert get_bucket_start(datetime.datetime.fromisoformat(timestamp)) == expected
