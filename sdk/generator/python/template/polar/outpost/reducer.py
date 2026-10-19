import collections.abc
import dataclasses
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
    func: typing.Literal["sum", "max", "min", "avg"]
    property: str


Aggregation: typing.TypeAlias = CountAggregation | PropertyAggregation


class Reducer(typing.TypedDict):
    id: str
    filter: Filter
    aggregation: Aggregation
    meter_ids: typing.NotRequired[list[str]]


EventMatcher: typing.TypeAlias = collections.abc.Callable[[Event], bool]


@dataclasses.dataclass
class BucketStatistics:
    count: int = 0
    sum: int | float = 0
    min: int | float | None = None
    max: int | float | None = None

    def add(self, other: "BucketStatistics") -> None:
        total = self.sum + other.sum
        if isinstance(total, float) and not math.isfinite(total):
            raise ValueError("Aggregation values must be finite")
        self.count += other.count
        self.sum = total
        if other.min is not None:
            self.min = min(self.min, other.min) if self.min is not None else other.min
        if other.max is not None:
            self.max = max(self.max, other.max) if self.max is not None else other.max

    def quantity(self, func: str) -> int | float:
        match func:
            case "count":
                return self.count
            case "sum":
                return self.sum
            case "min":
                return self.min if self.min is not None else 0
            case "max":
                return self.max if self.max is not None else 0
            case "avg":
                return self.sum / self.count if self.count else 0
            case _:
                raise ValueError(f"Unsupported aggregation: {func}")


Updates: typing.TypeAlias = dict[tuple[str, str, int], BucketStatistics]
BUCKET_SIZE = 300_000_000
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
            if filter_operator in (operator.eq, operator.ne):
                return filter_operator(actual, expected)
            same_type = type(actual) is expected_type or (
                type(actual) in (int, float) and expected_type in (int, float)
            )
            if not same_type:
                return False
            if type(actual) not in (int, float, str):
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


def with_matchers(
    reducers: collections.abc.Iterable[Reducer],
) -> list[tuple[Reducer, EventMatcher]]:
    return [(reducer, get_matcher(reducer["filter"])) for reducer in reducers]


def get_bucket_start(timestamp: datetime.datetime) -> int:
    if timestamp.utcoffset() is None:
        raise ValueError("Bucket timestamps must include a timezone")
    delta = timestamp - datetime.datetime(1970, 1, 1, tzinfo=datetime.UTC)
    epoch = (delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds
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
                if not isinstance(raw_value, (int, float)) or isinstance(
                    raw_value, bool
                ):
                    continue
                value = typing.cast(int | float, raw_value)
                if isinstance(value, float) and not math.isfinite(value):
                    raise ValueError("Aggregation values must be finite")

            update_key = (event.external_customer_id, reducer["id"], bucket_start)
            statistics = updates.setdefault(update_key, BucketStatistics())
            statistics.add(
                BucketStatistics(count=1)
                if func == "count"
                else BucketStatistics(count=1, sum=value, min=value, max=value)
            )
    return updates
