import datetime
import typing

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
    with_matchers,
)

TIMESTAMP = datetime.datetime(2026, 10, 12, 12, 4, 59, tzinfo=datetime.UTC)


@pytest.mark.parametrize(
    ("func", "expected"),
    [("count", 3), ("sum", -2), ("min", -5), ("max", 3), ("avg", -2 / 3)],
)
def test_reduce_buckets(
    func: typing.Literal["count", "sum", "max", "min", "avg"], expected: float
) -> None:
    reducer: Reducer = {
        "id": "usage",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "count"}
        if func == "count"
        else {"func": func, "property": "tokens"},
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
        with_matchers([reducer]),
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
    reducer: Reducer = {
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
    }
    matcher = get_matcher(reducer["filter"])
    assert matcher(Event("call", "customer", TIMESTAMP, {"llm": {"tokens": 2}}))
    assert not matcher(Event("call", "customer", TIMESTAMP, {"llm": {"tokens": True}}))
    assert not matcher(Event("other", "customer", TIMESTAMP, {"llm": {"tokens": 2}}))
    assert not matcher(Event("call", "customer", TIMESTAMP))


@pytest.mark.parametrize("conjunction", ["and", "or"])
def test_empty_conjunction_matches_every_event(
    conjunction: typing.Literal["and", "or"],
) -> None:
    matcher = get_matcher({"conjunction": conjunction, "clauses": []})
    assert matcher(Event("call", "customer", TIMESTAMP))


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
    operator: typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"],
    actual: str | float | bool,
    expected: str | float | bool,
    equal: bool,
) -> None:
    clause: FilterClause = {
        "property": "value",
        "operator": operator,
        "value": expected,
    }
    assert get_matcher(clause)(
        Event("call", "customer", TIMESTAMP, {"value": actual})
    ) is (equal if operator == "eq" else not equal)


@pytest.mark.parametrize(
    ("actual", "expected", "contained"),
    [
        ("gpt-4o-mini", "4o", True),
        ("gpt-4o-mini", "claude", False),
        ("gpt-4o-mini", "GPT", False),
        ("100%_done", "%_", True),
    ],
)
def test_contains_filters_compare_strings(
    actual: str, expected: str, contained: bool
) -> None:
    event = Event("call", "customer", TIMESTAMP, {"value": actual})
    like: FilterClause = {"property": "value", "operator": "like", "value": expected}
    not_like: FilterClause = {
        "property": "value",
        "operator": "not_like",
        "value": expected,
    }
    assert get_matcher(like)(event) is contained
    assert get_matcher(not_like)(event) is not contained


@pytest.mark.parametrize(
    ("actual", "expected"), [(1234, "23"), (True, "True"), ("1234", 23), ("True", True)]
)
@pytest.mark.parametrize("operator", ["like", "not_like"])
def test_contains_filters_match_strings_only(
    actual: str | int | bool,
    expected: str | int | bool,
    operator: typing.Literal["like", "not_like"],
) -> None:
    event = Event("call", "customer", TIMESTAMP, {"value": actual})
    clause: FilterClause = {
        "property": "value",
        "operator": operator,
        "value": expected,
    }
    assert get_matcher(clause)(event) is False


@pytest.mark.parametrize("operator", ["like", "not_like"])
def test_contains_filters_ignore_missing_properties(
    operator: typing.Literal["like", "not_like"],
) -> None:
    clause: FilterClause = {"property": "missing", "operator": operator, "value": "a"}
    assert not get_matcher(clause)(Event("call", "customer", TIMESTAMP))


@pytest.mark.parametrize("value", [True, "5", None])
def test_non_numeric_aggregation_is_skipped(value: object) -> None:
    reducer: Reducer = {
        "id": "tokens",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "tokens"},
    }
    assert (
        reduce(
            with_matchers([reducer]),
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
            with_matchers([reducer]),
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
