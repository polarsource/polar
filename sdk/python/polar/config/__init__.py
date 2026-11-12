from __future__ import annotations

import functools
import typing

if typing.TYPE_CHECKING:
    from polar.v2027_01 import inputs, literals

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


def _group(condition: Condition) -> inputs.Filter:
    if "conjunction" in condition:
        return typing.cast("inputs.Filter", condition)
    return and_(condition)


def _clauses(group: inputs.Filter) -> list[Condition]:
    return group["clauses"] if group["conjunction"] == "and" else [group]


class Meter:
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
        names = [on] if isinstance(on, str) else list(on or ())
        events = [eq("name", event) for event in names]
        selected = or_(*events) if len(events) > 1 else and_(*events)
        if not events and where is None:
            raise ValueError(
                f"Meter {name!r} needs `on` or `where`. "
                "Pass `where=and_()` to meter every event."
            )
        if where is None:
            self.filter = selected
        elif not events:
            self.filter = _group(where)
        else:
            self.filter = and_(*_clauses(selected), *_clauses(_group(where)))
        self.name = name
        self.aggregation = aggregate or Count()
        self.external_id = external_id
        self.options = options

    def to_dict(self, attribute: str) -> dict[str, typing.Any]:
        return {
            "external_id": attribute if self.external_id is None else self.external_id,
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
        entries: dict[str, Meter] = {}
        for owner in reversed(cls.__mro__):
            mangled = f"_{owner.__name__.lstrip('_')}__"
            for name, value in vars(owner).items():
                if not isinstance(value, Meter):
                    continue
                if name.startswith(mangled):
                    raise ValueError(
                        f"{owner.__name__}.__{name.removeprefix(mangled)}: Python "
                        'renames attributes that start with "__". Use another name.'
                    )
                entries[name] = value
        return entries


class Config:
    """The billing config of an organization.

    Assign it to a module-level variable named `config`.
    """

    def __init__(self, *, meters: type[MeterSet] | None = None) -> None:
        self.meters = meters

    def to_dict(self) -> dict[str, typing.Any]:
        meters = self.meters._entries() if self.meters else {}
        return {
            "meters": [meter.to_dict(attribute) for attribute, meter in meters.items()]
        }
