import collections.abc
import dataclasses
import typing

from polar.config.definitions import Definition, DefinitionSet, definition_fields
from polar.{{ latest }}.inputs import ConfigMeter, Filter, FilterClause
from polar.{{ latest }}.literals import FilterConjunction, FilterOperator, MeterUnit

Scalar: typing.TypeAlias = str | int | bool
Condition: typing.TypeAlias = FilterClause | Filter


def _comparison(
    operator: FilterOperator,
) -> typing.Callable[[str, Scalar], FilterClause]:
    def compare(property: str, value: Scalar) -> FilterClause:
        return FilterClause(property=property, operator=operator, value=value)

    return compare


def _group(conjunction: FilterConjunction) -> typing.Callable[..., Filter]:
    def group(*clauses: Condition) -> Filter:
        return Filter(conjunction=conjunction, clauses=list(clauses))

    return group


eq = _comparison("eq")
ne = _comparison("ne")
gt = _comparison("gt")
gte = _comparison("gte")
lt = _comparison("lt")
lte = _comparison("lte")
like = _comparison("like")
not_like = _comparison("not_like")


and_ = _group("and")
or_ = _group("or")


@dataclasses.dataclass(frozen=True, kw_only=True)
class Meter(Definition):
    """A meter over the events named in `on`, narrowed by `where`.

    It counts events unless `sum`, `max`, `min`, `avg` or `unique` names the property to
    aggregate. A `unit="custom"` needs a `label` such as "tool calls".
    """

    name: str | None = dataclasses.field(default=None, kw_only=False)
    on: str | collections.abc.Sequence[str] | None = None
    where: Condition | None = None
    unit: MeterUnit = "scalar"
    label: str | None = None
    sum: str | None = None
    max: str | None = None
    min: str | None = None
    avg: str | None = None
    unique: str | None = None

    def __post_init__(self) -> None:
        if self.unit == "custom" and not self.label:
            raise ValueError('A meter with unit="custom" needs a label.')
        if self.unit != "custom" and self.label is not None:
            raise ValueError('A label needs unit="custom".')
        _aggregation(self)

    def describe(self) -> str:
        return repr(self.name) if self.name else super().describe()

    @property
    def filter(self) -> Filter:
        return _filter(self.on, self.where)

    @property
    def aggregation(self) -> dict[str, str]:
        return _aggregation(self)


class MeterSet(DefinitionSet[Meter]):
    item = Meter


def meter_config(definition: Meter) -> ConfigMeter:
    config: dict[str, typing.Any] = {
        "external_id": definition.id,
        "name": definition.name if definition.name is not None else definition.id,
        "filter": definition.filter,
        "aggregation": definition.aggregation,
        "unit": definition.unit,
        **definition_fields(definition),
    }
    if definition.label is not None:
        config["custom_label"] = definition.label
    return typing.cast(ConfigMeter, config)


def _filter(
    on: str | collections.abc.Sequence[str] | None, where: Condition | None
) -> Filter:
    events = [on] if isinstance(on, str) else list(on or ())
    clauses: list[Condition] = []
    if len(events) == 1:
        clauses.append(eq("name", events[0]))
    elif events:
        clauses.append(or_(*(eq("name", event) for event in events)))
    if where is not None:
        if "conjunction" in where and where["conjunction"] == "and":
            clauses.extend(typing.cast(Filter, where)["clauses"])
        else:
            clauses.append(where)
    return and_(*clauses)


def _aggregation(meter: "Meter") -> dict[str, str]:
    candidates = {
        "sum": meter.sum,
        "max": meter.max,
        "min": meter.min,
        "avg": meter.avg,
        "unique": meter.unique,
    }
    chosen = {
        func: property for func, property in candidates.items() if property is not None
    }
    if len(chosen) > 1:
        raise ValueError(
            f"A meter aggregates one property: pass only one of {', '.join(chosen)}."
        )
    if not chosen:
        return {"func": "count"}
    ((func, property),) = chosen.items()
    return {"func": func, "property": property}
