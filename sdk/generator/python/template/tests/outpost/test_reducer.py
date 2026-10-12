import datetime

import pytest

from polar import PolarDeserializationError, deserialize
from polar.outpost.event import Event
from polar.outpost.reducer import Reducer, get_bucket_start, get_matcher, reduce

TIMESTAMP = datetime.datetime(2026, 10, 12, 12, 4, 59, tzinfo=datetime.UTC)


@pytest.mark.parametrize(
    ("func", "expected"), [("count", 3), ("sum", -2), ("min", -5), ("max", 3)]
)
def test_reduce_buckets(func: str, expected: int) -> None:
    reducer = deserialize(
        {
            "id": "usage",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": func, "property": "tokens"},
        },
        Reducer,
    )
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
        ("customer", "usage", bucket_start, func): expected,
        ("other", "usage", bucket_start, func): 1 if func == "count" else 2,
        ("customer", "usage", bucket_start + 300, func): 1 if func == "count" else 4,
    }


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


def test_unsupported_configuration_is_rejected() -> None:
    with pytest.raises(PolarDeserializationError):
        deserialize(
            {
                "id": "tokens",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "avg", "property": "tokens"},
            },
            Reducer,
        )

