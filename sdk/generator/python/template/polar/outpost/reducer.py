import collections.abc
import dataclasses
import datetime
import math
import operator
import typing

import typing_extensions

from polar.outpost.event import Event, PropertyReader, get_property_reader


class FilterClause(typing.TypedDict):
    property: str
    operator: typing.Literal["eq", "ne", "gt", "gte", "lt", "lte", "like", "not_like"]
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
ReducerMatcher: typing.TypeAlias = tuple["Reducer", EventMatcher, PropertyReader]


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

    def add_value(self, value: int | float) -> None:
        total = self.sum + value
        if isinstance(total, float) and not math.isfinite(total):
            raise ValueError("Aggregation values must be finite")
        self.count += 1
        self.sum = total
        self.min = min(self.min, value) if self.min is not None else value
        self.max = max(self.max, value) if self.max is not None else value

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
EPOCH = datetime.datetime(1970, 1, 1, tzinfo=datetime.UTC)
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
        read = get_property_reader(clause["property"])

        if clause["operator"] in ("like", "not_like"):
            # Polar compares strings; a number or boolean on either side matches nothing.
            if not isinstance(expected, str):
                return lambda event: False
            contains = clause["operator"] == "like"

            def contains_matcher(event: Event) -> bool:
                actual = read(event)
                return isinstance(actual, str) and (expected in actual) is contains

            return contains_matcher

        filter_operator = FILTER_OPERATORS[clause["operator"]]
        if filter_operator in (operator.eq, operator.ne):

            def equality_matcher(event: Event) -> bool:
                actual = read(event)
                return actual is not None and filter_operator(actual, expected)

            return equality_matcher

        if expected_type in (int, float):
            comparable: tuple[type, ...] = (int, float)
        elif expected_type is str:
            comparable = (str,)
        else:
            return lambda event: False

        def ordering_matcher(event: Event) -> bool:
            actual = read(event)
            return type(actual) in comparable and filter_operator(actual, expected)

        return ordering_matcher

    child_matchers = [get_matcher(child) for child in clause["clauses"]]
    if not child_matchers:
        return lambda event: True
    if len(child_matchers) == 1:
        return child_matchers[0]
    if clause["conjunction"] == "and":

        def all_matcher(event: Event) -> bool:
            for child_matcher in child_matchers:
                if not child_matcher(event):
                    return False
            return True

        return all_matcher

    def any_matcher(event: Event) -> bool:
        for child_matcher in child_matchers:
            if child_matcher(event):
                return True
        return False

    return any_matcher


def with_matchers(
    reducers: collections.abc.Iterable[Reducer],
) -> list[ReducerMatcher]:
    return [
        (
            reducer,
            get_matcher(reducer["filter"]),
            (lambda event: 1)
            if reducer["aggregation"]["func"] == "count"
            else get_property_reader(reducer["aggregation"]["property"]),
        )
        for reducer in reducers
    ]


def get_bucket_start(timestamp: datetime.datetime) -> int:
    if timestamp.utcoffset() is None:
        raise ValueError("Bucket timestamps must include a timezone")
    delta = timestamp - EPOCH
    epoch = (delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds
    return epoch - epoch % BUCKET_SIZE


def reduce(
    reducers: collections.abc.Sequence[ReducerMatcher],
    events: collections.abc.Sequence[Event],
    *,
    oldest_bucket_start: int,
) -> Updates:
    updates: Updates = {}
    for event in events:
        bucket_start = get_bucket_start(event.timestamp)
        if bucket_start < oldest_bucket_start:
            continue
        for reducer, matcher, read in reducers:
            if not matcher(event):
                continue
            value = read(event)
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                continue
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("Aggregation values must be finite")

            update_key = (event.external_customer_id, reducer["id"], bucket_start)
            statistics = updates.get(update_key)
            if statistics is None:
                statistics = updates[update_key] = BucketStatistics()
            if reducer["aggregation"]["func"] == "count":
                statistics.count += 1
            else:
                statistics.add_value(value)
    return updates
