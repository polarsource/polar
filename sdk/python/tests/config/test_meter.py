import typing

import pytest

from polar.config import (
    Aggregation,
    Avg,
    Condition,
    Count,
    Max,
    Meter,
    Min,
    Sum,
    Unique,
    and_,
    eq,
    gt,
    gte,
    like,
    lt,
    lte,
    ne,
    not_like,
    or_,
)

REQUEST = {"property": "name", "operator": "eq", "value": "request"}
SEARCH = {"property": "name", "operator": "eq", "value": "search"}
SLOW = {"property": "duration", "operator": "gt", "value": 500}
FAILED = {"property": "status", "operator": "eq", "value": "error"}


@pytest.mark.parametrize(
    ("compare", "operator"),
    [
        (eq, "eq"),
        (ne, "ne"),
        (gt, "gt"),
        (gte, "gte"),
        (lt, "lt"),
        (lte, "lte"),
        (like, "like"),
        (not_like, "not_like"),
    ],
)
def test_comparisons(
    compare: typing.Callable[[str, int], Condition], operator: str
) -> None:
    assert compare("duration", 500) == {
        "property": "duration",
        "operator": operator,
        "value": 500,
    }


@pytest.mark.parametrize(
    ("aggregation", "expected"),
    [
        (Count(), {"func": "count"}),
        (Sum("tokens"), {"func": "sum", "property": "tokens"}),
        (Max("tokens"), {"func": "max", "property": "tokens"}),
        (Min("tokens"), {"func": "min", "property": "tokens"}),
        (Avg("tokens"), {"func": "avg", "property": "tokens"}),
        (Unique("user"), {"func": "unique", "property": "user"}),
    ],
)
def test_aggregations(aggregation: Aggregation, expected: dict[str, str]) -> None:
    assert aggregation == expected


@pytest.mark.parametrize(
    ("where", "clauses"),
    [
        (and_(gt("duration", 500), eq("status", "error")), [REQUEST, SLOW, FAILED]),
        (
            or_(gt("duration", 500), eq("status", "error")),
            [REQUEST, {"conjunction": "or", "clauses": [SLOW, FAILED]}],
        ),
    ],
)
def test_where_joins_the_event_filter(where: Condition, clauses: list[object]) -> None:
    meter = Meter("Requests", on="request", where=where)

    assert meter.filter == {"conjunction": "and", "clauses": clauses}


@pytest.mark.parametrize(
    ("on", "where", "expected"),
    [
        (
            ["request", "search"],
            None,
            {"conjunction": "or", "clauses": [REQUEST, SEARCH]},
        ),
        (
            ["request", "search"],
            gt("duration", 500),
            {
                "conjunction": "and",
                "clauses": [{"conjunction": "or", "clauses": [REQUEST, SEARCH]}, SLOW],
            },
        ),
        (None, None, {"conjunction": "and", "clauses": []}),
        (None, gt("duration", 500), {"conjunction": "and", "clauses": [SLOW]}),
        (
            None,
            or_(gt("duration", 500), eq("status", "error")),
            {"conjunction": "or", "clauses": [SLOW, FAILED]},
        ),
        (
            None,
            and_(or_(eq("name", "request"))),
            {
                "conjunction": "and",
                "clauses": [{"conjunction": "or", "clauses": [REQUEST]}],
            },
        ),
    ],
)
def test_filter_without_a_single_event(
    on: list[str] | None, where: "Condition | None", expected: dict[str, object]
) -> None:
    assert Meter("Requests", on=on, where=where).filter == expected
