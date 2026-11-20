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
    match_event,
    with_matchers,
)

TIMESTAMP = datetime.datetime(2026, 10, 12, 12, 4, 59, tzinfo=datetime.UTC)


@pytest.mark.parametrize(
    ("func", "expected"),
    [("count", 3), ("sum", -2), ("min", -5), ("max", 3), ("avg", -2 / 3)],
)
def test_matches_events_with_the_value_their_reducer_adds_up(
    func: typing.Literal["count", "sum", "max", "min", "avg"], expected: float
) -> None:
    reducer: Reducer = {
        "id": "usage",
        "kind": "usage",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "count"}
        if func == "count"
        else {"func": func, "property": "tokens"},
    }
    matchers = with_matchers([reducer])
    statistics = BucketStatistics()
    for tokens in [-5, 0, 3]:
        event = Event("call", "customer", TIMESTAMP, {"tokens": tokens})
        [(reducer_id, value)] = match_event(matchers, event)
        assert reducer_id == "usage"
        if func == "count":
            assert value is None
            statistics.count += 1
        else:
            assert value == tokens
            statistics.add_value(tokens)
    assert statistics.quantity(func) == expected


@pytest.mark.parametrize("func", ["count", "sum", "min", "max", "avg"])
def test_empty_statistics(func: str) -> None:
    assert BucketStatistics().quantity(func) == 0


def test_nested_configuration_and_metadata() -> None:
    reducer: Reducer = {
        "id": "tokens",
        "kind": "usage",
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
        (True, True, True),
        (1, 1.0, True),
        (True, 1, False),
        (1, True, False),
        (False, 0, False),
        (0, False, False),
        (True, 1.0, False),
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
        "kind": "usage",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "tokens"},
    }
    event = Event("call", "customer", TIMESTAMP, {"tokens": value})
    assert match_event(with_matchers([reducer]), event) == []


def test_statistics_reject_a_total_too_large_to_hold() -> None:
    statistics = BucketStatistics()
    statistics.add_value(1e308)
    with pytest.raises(ValueError, match="finite"):
        statistics.add_value(1e308)


@pytest.mark.parametrize("value", [float("nan"), float("inf")])
def test_non_finite_aggregation_is_rejected(value: float) -> None:
    reducer: Reducer = {
        "id": "tokens",
        "kind": "usage",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "tokens"},
    }
    with pytest.raises(ValueError, match="finite"):
        match_event(
            with_matchers([reducer]),
            Event("call", "customer", TIMESTAMP, {"tokens": value}),
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


def test_credit_reducers_match_no_local_event() -> None:
    reducer: Reducer = {
        "id": "credits",
        "kind": "credit",
        "filter": {"conjunction": "and", "clauses": []},
        "aggregation": {"func": "sum", "property": "units"},
    }
    event = Event("call", "customer", TIMESTAMP, {"units": 1})

    assert match_event(with_matchers([reducer]), event) == []
