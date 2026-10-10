import collections.abc
import datetime
import math
import operator
import typing

from outpost.event import EventCreate


class FilterClause(typing.TypedDict):
    property: str
    operator: typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"]
    value: str | int | float | bool


class Filter(typing.TypedDict):
    conjunction: typing.Literal["and", "or"]
    clauses: list[FilterClause | Filter]


class CountAggregation(typing.TypedDict):
    func: typing.Literal["count"]


class PropertyAggregation(typing.TypedDict):
    func: typing.Literal["sum", "max", "min"]
    property: str


type Aggregation = CountAggregation | PropertyAggregation


class Reducer(typing.TypedDict):
    id: str
    filter: Filter
    aggregation: Aggregation


FILTER_OPERATORS = {
    "eq": operator.eq,
    "ne": operator.ne,
    "gt": operator.gt,
    "gte": operator.ge,
    "lt": operator.lt,
    "lte": operator.le,
}


def is_filter_clause(clause: Filter | FilterClause) -> typing.TypeIs[FilterClause]:
    return "property" in clause


type EventMatcher = collections.abc.Callable[[EventCreate], bool]


def get_matcher(clause: Filter | FilterClause) -> EventMatcher:
    if is_filter_clause(clause):
        expected = clause["value"]
        expected_type = type(expected)
        operator_name = clause["operator"]
        filter_operator = FILTER_OPERATORS[operator_name]
        property = clause["property"]

        def matcher(event: EventCreate) -> bool:
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
            ) not in (int, float, str):
                return False
            return filter_operator(actual, expected)

        return matcher

    child_matchers = [get_matcher(child) for child in clause["clauses"]]
    conjunction_operator = all if clause["conjunction"] == "and" else any

    def matcher(event: EventCreate) -> bool:
        return conjunction_operator(
            child_matcher(event) for child_matcher in child_matchers
        )

    return matcher


BUCKET_SIZE = 300


def get_bucket_start(timestamp: datetime.datetime) -> int:
    epoch = int(timestamp.timestamp())
    return epoch - epoch % BUCKET_SIZE


type Updates = dict[tuple[str, str, int, str], int | float]

type EventKey = tuple[str, int, str]


def get_event_keys(events: collections.abc.Sequence[EventCreate]) -> list[EventKey]:
    return [
        (
            event.external_customer_id,
            get_bucket_start(event.timestamp),
            event.external_id,
        )
        for event in events
        if event.external_id is not None
    ]


class SnapshotBucket(typing.TypedDict):
    reducer_id: str
    bucket_start: int
    value: int | float


class Snapshot(typing.TypedDict):
    external_customer_id: str
    cold_until: int
    cold: dict[str, int | float]
    credited: dict[str, int | float]
    buckets: list[SnapshotBucket]


class CustomerState(typing.TypedDict):
    cold_until: int | None
    cold: dict[str, int | float]
    credited: dict[str, int | float]
    buckets: dict[tuple[str, int], int | float]


def get_consumed(reducer: Reducer, state: CustomerState) -> int | float:
    values = [
        value
        for (reducer_id, _), value in state["buckets"].items()
        if reducer_id == reducer["id"]
    ]
    if reducer["id"] in state["cold"]:
        values.append(state["cold"][reducer["id"]])
    if not values:
        return 0
    match reducer["aggregation"]["func"]:
        case "min":
            return min(values)
        case "max":
            return max(values)
        case _:
            return sum(values)


def reduce(
    reducers: collections.abc.Sequence[tuple[Reducer, EventMatcher]],
    events: collections.abc.Sequence[EventCreate],
    *,
    oldest_bucket_start: int,
    claimed: collections.abc.Iterable[bool] = (),
) -> Updates:
    is_new = iter(claimed)
    updates: Updates = {}
    for event in events:
        if event.external_id is not None and not next(is_new):
            continue
        bucket_start = get_bucket_start(event.timestamp)
        # Polar counts older events in its own buckets; the next snapshot carries them.
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
                    message = "Aggregation values must be finite"
                    raise ValueError(message)

            update_key = (event.external_customer_id, reducer["id"], bucket_start, func)
            previous = updates.get(update_key)
            match func:
                case "count" | "sum":
                    value = (previous or 0) + value
                case "min":
                    value = min(previous, value) if previous is not None else value
                case "max":
                    value = max(previous, value) if previous is not None else value
            updates[update_key] = value

    return updates
