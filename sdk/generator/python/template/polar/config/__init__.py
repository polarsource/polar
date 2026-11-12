from __future__ import annotations

import functools
import typing

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


class Meter:
    """A meter over one event.

    Declare it on a `MeterSet`: the attribute name becomes its external ID.

    Args:
        name: Shown on customers' invoices and usage.
        on: Name of the event to meter.
        where: Extra conditions the event has to meet.
        aggregate: How matching events add up. Defaults to `Count()`.
        **options: Any other meter field, see `MeterOptions`.
    """

    def __init__(
        self,
        name: str,
        *,
        on: str,
        where: Condition | None = None,
        aggregate: Aggregation | None = None,
        **options: typing.Unpack[MeterOptions],
    ) -> None:
        conditions: list[Condition] = [] if where is None else [where]
        if where is not None and where.get("conjunction") == "and":
            conditions = typing.cast("inputs.Filter", where)["clauses"]
        self.name = name
        self.filter = and_(eq("name", on), *conditions)
        self.aggregation = aggregate or Count()
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
    def _entries(cls) -> dict[str, Meter]:
        return {
            name: value
            for owner in reversed(cls.__mro__)
            for name, value in vars(owner).items()
            if isinstance(value, Meter)
        }


class Config:
    """The billing config of an organization.

    Assign it to a module-level variable named `config`.
    """

    def __init__(self, *, meters: type[MeterSet] | None = None) -> None:
        self.meters = meters

    def to_dict(self) -> dict[str, typing.Any]:
        meters = self.meters._entries() if self.meters else {}
        return {
            "meters": [
                meter.to_dict(external_id) for external_id, meter in meters.items()
            ]
        }
