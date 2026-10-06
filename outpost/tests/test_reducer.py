import typing
from datetime import UTC, datetime

import pytest

from outpost.event import EventCreate
from outpost.reducer import FilterClause, Meter, matches, reduce


@pytest.fixture
def event() -> EventCreate:
    return EventCreate(
        timestamp=datetime(2026, 1, 1, tzinfo=UTC),
        name="usage",
        external_customer_id="customer",
    )


class TestReduce:
    def test_aggregations(self, event: EventCreate) -> None:
        meters: list[Meter] = [
            {
                "id": "count",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            }
        ]
        for func in ("sum", "min", "max"):
            meters.append(
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
        assert reduce(meters, events) == {
            ("customer", "count", "count"): 3,
            ("customer", "sum", "sum"): 2,
            ("customer", "min", "min"): -2,
            ("customer", "max", "max"): 4,
            ("other", "count", "count"): 1,
            ("other", "sum", "sum"): 7,
            ("other", "min", "min"): 7,
            ("other", "max", "max"): 7,
        }
        assert reduce(meters, []) == {}
        assert reduce([], events) == {}

    def test_filters(self, event: EventCreate) -> None:
        meter: Meter = {
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
        assert reduce([meter], events) == {("customer", "count", "count"): 1}

    @pytest.mark.parametrize("amount", [None, "3", True])
    def test_skips_non_numeric_values(
        self, event: EventCreate, amount: str | bool | None
    ) -> None:
        meter: Meter = {
            "id": "sum",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "sum", "property": "amount"},
        }
        event.metadata = {} if amount is None else {"amount": amount}
        assert reduce([meter], [event]) == {}

    @pytest.mark.parametrize(
        ("func", "amount", "message"),
        [
            ("sum", 1.5, "integer"),
            ("sum", 2**63, "64-bit"),
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
        meter: Meter = {
            "id": "meter",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": func, "property": "amount"},
        }
        event.metadata = {"amount": amount}
        with pytest.raises(ValueError, match=message):
            reduce([meter], [event])


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
def test_matches(
    operator: typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"],
    actual: object,
    expected: str | float | bool,
    result: bool,
) -> None:
    clause: FilterClause = {
        "property": "value",
        "operator": operator,
        "value": expected,
    }
    assert matches({"value": actual}.get, clause) is result
    assert matches({}.get, {"conjunction": "and", "clauses": []}) is True
    assert matches({}.get, {"conjunction": "or", "clauses": []}) is False
