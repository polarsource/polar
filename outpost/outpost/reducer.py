import collections.abc
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


class Meter(typing.TypedDict):
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


def is_filter(clause: Filter | FilterClause) -> typing.TypeIs[Filter]:
    return "clauses" in clause


def matches(
    get_property: collections.abc.Callable[[str], object], clause: Filter | FilterClause
) -> bool:
    if is_filter(clause):
        results = (matches(get_property, child) for child in clause["clauses"])
        match clause["conjunction"]:
            case "and":
                return all(results)
            case "or":
                return any(results)
            case _:
                raise ValueError()

    actual = get_property(clause["property"])
    expected = clause["value"]
    if actual is None:
        return False
    same_type = type(actual) is type(expected) or (
        type(actual) in (int, float) and type(expected) in (int, float)
    )
    if not same_type:
        return clause["operator"] == "ne"
    actual = typing.cast(str | int | float | bool, actual)
    if clause["operator"] not in ("eq", "ne") and type(actual) not in (int, float, str):
        return False
    return FILTER_OPERATORS[clause["operator"]](actual, expected)


type Updates = dict[tuple[str, str, str], int | float]


def reduce(
    meters: collections.abc.Sequence[Meter],
    events: collections.abc.Sequence[EventCreate],
) -> Updates:
    updates: Updates = {}
    for event in events:
        for meter in meters:
            if not matches(event.get_property, meter["filter"]):
                continue
            aggregation = meter["aggregation"]
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
                if func == "sum" and not isinstance(value, int):
                    message = "Sum requires integer values for HINCRBY"
                    raise ValueError(message)

            update_key = (event.external_customer_id, meter["id"], func)
            previous = updates.get(update_key)
            match func:
                case "count" | "sum":
                    value = (previous or 0) + value
                case "min":
                    value = min(previous, value) if previous is not None else value
                case "max":
                    value = max(previous, value) if previous is not None else value
            updates[update_key] = value

    for (_, _, func), value in updates.items():
        if func in ("count", "sum") and not -(2**63) <= value < 2**63:
            message = "Increment exceeds the signed 64-bit integer range"
            raise ValueError(message)
    return updates
