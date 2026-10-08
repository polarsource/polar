import typing
from datetime import UTC, datetime
from unittest.mock import patch

import pytest

from outpost.event import EventCreate
from outpost.reducer import (
    BUCKET_SIZE,
    FilterClause,
    Reducer,
    get_matcher,
    reduce,
)

BUCKET = 1767225600


@pytest.fixture
def event() -> EventCreate:
    return EventCreate(
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        name="usage",
        external_customer_id="customer",
    )


class TestReduce:
    def test_aggregations(self, event: EventCreate) -> None:
        reducers: list[Reducer] = [
            {
                "id": "count",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            }
        ]
        for func in ("sum", "min", "max"):
            reducers.append(
                {
                    "id": func,
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": func, "property": "amount"},
                }
            )
        events = [
            event.model_copy(update={"metadata": {"amount": amount}})
            for amount in (4, 0, -2)
        ]
        events.insert(
            1,
            event.model_copy(
                update={"external_customer_id": "other", "metadata": {"amount": 7}}
            ),
        )
        reducer_matchers = [
            (reducer, get_matcher(reducer["filter"])) for reducer in reducers
        ]
        assert reduce(reducer_matchers, events, oldest_bucket_start=BUCKET) == {
            ("customer", "count", BUCKET, "count"): 3,
            ("customer", "sum", BUCKET, "sum"): 2,
            ("customer", "min", BUCKET, "min"): -2,
            ("customer", "max", BUCKET, "max"): 4,
            ("other", "count", BUCKET, "count"): 1,
            ("other", "sum", BUCKET, "sum"): 7,
            ("other", "min", BUCKET, "min"): 7,
            ("other", "max", BUCKET, "max"): 7,
        }
        assert reduce(reducer_matchers, [], oldest_bucket_start=BUCKET) == {}
        assert reduce([], events, oldest_bucket_start=BUCKET) == {}

    def test_buckets(self, event: EventCreate) -> None:
        reducer: Reducer = {
            "id": "count",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "count"},
        }
        events = [
            event.model_copy(
                update={"timestamp": datetime.fromtimestamp(timestamp, UTC)}
            )
            for timestamp in (
                BUCKET - 1,
                BUCKET,
                BUCKET + BUCKET_SIZE - 1,
                BUCKET + BUCKET_SIZE,
            )
        ]
        assert reduce(
            [(reducer, get_matcher(reducer["filter"]))],
            events,
            oldest_bucket_start=BUCKET,
        ) == {
            ("customer", "count", BUCKET, "count"): 2,
            ("customer", "count", BUCKET + BUCKET_SIZE, "count"): 1,
        }

    def test_sums_decimals(self, event: EventCreate) -> None:
        reducer: Reducer = {
            "id": "sum",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "sum", "property": "amount"},
        }
        events = [
            event.model_copy(update={"metadata": {"amount": amount}})
            for amount in (0.5, 1.25, 2)
        ]
        assert reduce(
            [(reducer, get_matcher(reducer["filter"]))],
            events,
            oldest_bucket_start=BUCKET,
        ) == {("customer", "sum", BUCKET, "sum"): 3.75}

    def test_filters(self, event: EventCreate) -> None:
        reducer: Reducer = {
            "id": "count",
            "filter": {
                "conjunction": "and",
                "clauses": [
                    {"property": "name", "operator": "eq", "value": "usage"},
                    {"property": "enabled", "operator": "eq", "value": False},
                    {
                        "conjunction": "or",
                        "clauses": [
                            {"property": "missing", "operator": "ne", "value": 1},
                            {"property": "tier", "operator": "eq", "value": "paid"},
                        ],
                    },
                ],
            },
            "aggregation": {"func": "count"},
        }
        matching = event.model_copy(
            update={"metadata": {"tier": "paid", "enabled": False}}
        )
        events = [
            matching,
            matching.model_copy(
                update={
                    "name": "other",
                    "metadata": {"name": "usage", "tier": "paid", "enabled": False},
                }
            ),
            matching.model_copy(update={"metadata": {"tier": "paid", "enabled": True}}),
        ]
        matcher = get_matcher(reducer["filter"])
        with patch("outpost.reducer.get_matcher", wraps=get_matcher) as compile_matcher:
            assert reduce([(reducer, matcher)], events, oldest_bucket_start=BUCKET) == {
                ("customer", "count", BUCKET, "count"): 1
            }
            compile_matcher.assert_not_called()

    @pytest.mark.parametrize("amount", [None, "3", True])
    def test_skips_non_numeric_values(
        self, event: EventCreate, amount: str | bool | None
    ) -> None:
        reducer: Reducer = {
            "id": "sum",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "sum", "property": "amount"},
        }
        event.metadata = {} if amount is None else {"amount": amount}
        assert (
            reduce(
                [(reducer, get_matcher(reducer["filter"]))],
                [event],
                oldest_bucket_start=BUCKET,
            )
            == {}
        )

    @pytest.mark.parametrize(
        ("func", "amount", "message"),
        [
            ("min", float("inf"), "finite"),
            ("max", float("nan"), "finite"),
        ],
    )
    def test_rejects_invalid_numbers(
        self,
        event: EventCreate,
        func: typing.Literal["sum", "min", "max"],
        amount: float,
        message: str,
    ) -> None:
        reducer: Reducer = {
            "id": "reducer",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": func, "property": "amount"},
        }
        event.metadata = {"amount": amount}
        with pytest.raises(ValueError, match=message):
            reduce(
                [(reducer, get_matcher(reducer["filter"]))],
                [event],
                oldest_bucket_start=BUCKET,
            )


@pytest.mark.parametrize(
    ("operator", "actual", "expected", "result"),
    [
        ("eq", 1, 1.0, True),
        ("eq", False, 0, False),
        ("ne", False, 0, True),
        ("gt", 2, 1, True),
        ("gte", 1, 1, True),
        ("lt", 1, 2, True),
        ("lte", 1, 1, True),
        ("gt", "b", "a", True),
        ("gt", "2", 1, False),
        ("gt", True, False, False),
        ("ne", None, 1, False),
    ],
)
def test_get_matcher(
    event: EventCreate,
    operator: typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"],
    actual: str | float | bool | None,
    expected: str | float | bool,
    result: bool,
) -> None:
    clause: FilterClause = {
        "property": "value",
        "operator": operator,
        "value": expected,
    }
    event.metadata = {} if actual is None else {"value": actual}
    assert get_matcher(clause)(event) is result
    assert get_matcher({"conjunction": "and", "clauses": []})(event) is True
    assert get_matcher({"conjunction": "or", "clauses": []})(event) is False
