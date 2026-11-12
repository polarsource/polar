from __future__ import annotations

import functools
import typing

from polar.config.entries import Entry, declared

if typing.TYPE_CHECKING:
    from polar.{{ ir.versions[-1] | format_version }} import inputs, literals

Aggregation: typing.TypeAlias = (
    "inputs.CountAggregation | inputs.PropertyAggregation | inputs.UniqueAggregation"
)
Condition: typing.TypeAlias = "inputs.FilterClause | inputs.Filter"


def _comparison(
    operator: literals.FilterOperator, property: str, value: str | int | bool
) -> inputs.FilterClause:
    return {"property": property, "operator": operator, "value": value}


eq = functools.partial(_comparison, "eq")
ne = functools.partial(_comparison, "ne")
gt = functools.partial(_comparison, "gt")
gte = functools.partial(_comparison, "gte")
lt = functools.partial(_comparison, "lt")
lte = functools.partial(_comparison, "lte")
like = functools.partial(_comparison, "like")
not_like = functools.partial(_comparison, "not_like")


def and_(*conditions: Condition) -> inputs.Filter:
    """Match events that meet every condition."""
    return {"conjunction": "and", "clauses": list(conditions)}


def or_(*conditions: Condition) -> inputs.Filter:
    """Match events that meet at least one condition."""
    return {"conjunction": "or", "clauses": list(conditions)}


def _aggregation(func: literals.Func, property: str) -> inputs.PropertyAggregation:
    return {"func": func, "property": property}


Sum = functools.partial(_aggregation, "sum")
Max = functools.partial(_aggregation, "max")
Min = functools.partial(_aggregation, "min")
Avg = functools.partial(_aggregation, "avg")


def Count() -> inputs.CountAggregation:
    """Count the matching events."""
    return {"func": "count"}


def Unique(property: str) -> inputs.UniqueAggregation:
    """Count the distinct values of an event property."""
    return {"func": "unique", "property": property}


class MeterOptions(typing.TypedDict, total=False):
    """Optional meter fields, named as in the Polar API."""

    unit: literals.MeterUnit
    custom_label: str
    custom_multiplier: int
    metadata: dict[str, str | int | float | bool]
    deprecated: bool


def _as_group(condition: Condition) -> inputs.Filter:
    if "conjunction" in condition:
        return typing.cast("inputs.Filter", condition)
    return and_(condition)


def _conditions(where: Condition) -> list[Condition]:
    group = _as_group(where)
    return group["clauses"] if group["conjunction"] == "and" else [group]


def _any_event(events: list[str]) -> Condition:
    named = [eq("name", event) for event in events]
    return named[0] if len(named) == 1 else or_(*named)


def _filter(
    on: str | typing.Sequence[str] | None, where: Condition | None
) -> inputs.Filter:
    events = [on] if isinstance(on, str) else list(on or ())
    if not events:
        return and_() if where is None else _as_group(where)
    if where is None:
        return _as_group(_any_event(events))
    return and_(_any_event(events), *_conditions(where))


class Meter(Entry):
    """A meter over your events.

    Declare it on a `MeterSet`: the attribute name becomes its external ID.

    Args:
        name: Shown on customers' invoices and usage.
        on: Name of the event to meter, or several names to meter any of them.
            Leave it out to select events with `where` alone.
        where: Extra conditions the event has to meet.
        aggregate: How matching events add up. Defaults to `Count()`.
        external_id: Replaces the attribute name as the external ID. For an ID
            that is not a Python name, like `tool-calls`.
        **options: Any other meter field, see `MeterOptions`.
    """

    def __init__(
        self,
        name: str,
        *,
        on: str | typing.Sequence[str] | None = None,
        where: Condition | None = None,
        aggregate: Aggregation | None = None,
        external_id: str | None = None,
        **options: typing.Unpack[MeterOptions],
    ) -> None:
        self.name = name
        self.filter = _filter(on, where)
        self.aggregation = aggregate or Count()
        self.external_id = external_id
        self.options = options

    def to_dict(self, external_id: str) -> dict[str, typing.Any]:
        return {
            "external_id": external_id,
            "name": self.name,
            "filter": self.filter,
            "aggregation": self.aggregation,
            **self.options,
        }


class MeterSet:
    """Subclass it and assign one `Meter` per attribute.

    A subclass of one of your sets keeps the meters it inherits.
    """

    @classmethod
    def _entries(cls) -> list[tuple[str, Meter]]:
        return declared(cls, Meter)
