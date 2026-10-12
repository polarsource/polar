import collections.abc
import datetime
import math
import operator
import typing

import typing_extensions

from polar.outpost.event import Event


class FilterClause(typing.TypedDict):
    property: str
    operator: typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"]
    value: str | int | float | bool


class Filter(typing.TypedDict):
    conjunction: typing.Literal["and", "or"]
    clauses: list["FilterClause | Filter"]


class CountAggregation(typing.TypedDict):
    func: typing.Literal["count"]


class PropertyAggregation(typing.TypedDict):
    func: typing.Literal["sum", "max", "min"]
    property: str


Aggregation: typing.TypeAlias = CountAggregation | PropertyAggregation


class Reducer(typing.TypedDict):
    id: str
    filter: Filter
    aggregation: Aggregation
    meter_ids: typing.NotRequired[list[str]]


EventMatcher: typing.TypeAlias = collections.abc.Callable[[Event], bool]
Updates: typing.TypeAlias = dict[tuple[str, str, int, str], int | float]
BUCKET_SIZE = 300
FILTER_OPERATORS = {
    "eq": operator.eq,
    "ne": operator.ne,
    "gt": operator.gt,
    "gte": operator.ge,
    "lt": operator.lt,
    "lte": operator.le,
}


def is_filter_clause(
    clause: Filter | FilterClause,
) -> typing_extensions.TypeIs[FilterClause]:
    return "property" in clause


def get_matcher(clause: Filter | FilterClause) -> EventMatcher:
    if is_filter_clause(clause):
        expected = clause["value"]
        expected_type = type(expected)
        filter_operator = FILTER_OPERATORS[clause["operator"]]
        property = clause["property"]

        def matcher(event: Event) -> bool:
            actual = event.get_property(property)
            if actual is None:
                return False
            same_type = type(actual) is expected_type or (
                type(actual) in (int, float) and expected_type in (int, float)
            )
            if not same_type:
                return filter_operator is operator.ne
            if filter_operator not in (operator.eq, operator.ne) and type(
                actual
            ) not in (
                int,
                float,
                str,
            ):
                return False
            return filter_operator(actual, expected)

        return matcher

    child_matchers = [get_matcher(child) for child in clause["clauses"]]
    conjunction_operator = all if clause["conjunction"] == "and" else any

    def matcher(event: Event) -> bool:
        return conjunction_operator(
            child_matcher(event) for child_matcher in child_matchers
        )

    return matcher


def get_bucket_start(timestamp: datetime.datetime) -> int:
    if timestamp.utcoffset() is None:
        raise ValueError("Bucket timestamps must include a timezone")
    epoch = math.floor(timestamp.timestamp())
    return epoch - epoch % BUCKET_SIZE


def reduce(
    reducers: collections.abc.Sequence[tuple[Reducer, EventMatcher]],
    events: collections.abc.Sequence[Event],
    *,
    oldest_bucket_start: int,
) -> Updates:
    updates: Updates = {}
    for event in events:
        bucket_start = get_bucket_start(event.timestamp)
        if bucket_start < oldest_bucket_start:
            continue
        for reducer, matcher in reducers:
            if not matcher(event):
                continue
            aggregation = reducer["aggregation"]
            func = aggregation["func"]
            if func == "count":
                value: int | float = 1
            else:
                raw_value = event.get_property(
                    typing.cast(PropertyAggregation, aggregation)["property"]
                )
                if type(raw_value) not in (int, float):
                    continue
                value = typing.cast(int | float, raw_value)
                if isinstance(value, float) and not math.isfinite(value):
                    raise ValueError("Aggregation values must be finite")

            update_key = (event.external_customer_id, reducer["id"], bucket_start, func)
            previous = updates.get(update_key)
            match func:
                case "count" | "sum":
                    value = (previous or 0) + value
                case "min":
                    value = min(previous, value) if previous is not None else value
                case "max":
                    value = max(previous, value) if previous is not None else value
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("Aggregation values must be finite")
            updates[update_key] = value
    return updates
