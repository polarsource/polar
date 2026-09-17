from collections.abc import Mapping
from enum import StrEnum
from typing import Annotated, Any

from annotated_types import Ge, Le, MaxLen
from pydantic import AfterValidator, BaseModel, TypeAdapter
from sqlalchemy import Dialect, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB

MAX_STRING_LENGTH = 1000
Int32 = Annotated[int, Ge(-2147483648), Le(2147483647)]


class FilterOperator(StrEnum):
    eq = "eq"
    ne = "ne"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    like = "like"
    not_like = "not_like"


class FilterConjunction(StrEnum):
    and_ = "and"
    or_ = "or"


def strip_metadata_prefix(value: str) -> str:
    return value.removeprefix("metadata.")


class FilterClause(BaseModel):
    property: Annotated[str, AfterValidator(strip_metadata_prefix)]
    operator: FilterOperator
    value: Annotated[str, MaxLen(MAX_STRING_LENGTH)] | Int32 | bool


class Filter(BaseModel):
    conjunction: FilterConjunction
    clauses: list["FilterClause | Filter"]


FilterTypeAdapter: TypeAdapter[Filter] = TypeAdapter(Filter)


def to_dnf(filter: Filter) -> list[list[FilterClause]]:
    parts = [
        [[clause]] if isinstance(clause, FilterClause) else to_dnf(clause)
        for clause in filter.clauses
    ]
    if filter.conjunction == FilterConjunction.or_:
        return [group for part in parts for group in part]
    groups: list[list[FilterClause]] = [[]]
    for part in parts:
        groups = [left + right for left in groups for right in part]
    return groups


class FilterType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, Filter):
            return value.model_dump(mode="json")
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is not None:
            return FilterTypeAdapter.validate_python(value)
        return value


def _text(value: Any) -> str:
    return str(value).lower() if isinstance(value, bool) else str(value)


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except TypeError, ValueError:
        return None


class EventMatcher:
    """Applies a reducer filter to one event in Python, the way the Tinybird pipe does.

    Values compare as strings, `like` is a case-insensitive substring test, and
    ordering is numeric only, so a judge reads the events the meter bills.
    """

    def __init__(self, filter: Filter | None) -> None:
        self.groups = to_dnf(filter) if filter is not None else []

    @property
    def event_names(self) -> list[str] | None:
        """Names every group pins with `name eq`, or None when a group leaves it open."""
        if not self.groups:
            return None
        names: set[str] = set()
        for group in self.groups:
            pinned = [
                str(clause.value)
                for clause in group
                if clause.property == "name" and clause.operator == FilterOperator.eq
            ]
            if not pinned:
                return None
            names.update(pinned)
        return sorted(names)

    def matches(self, name: str, metadata: Mapping[str, Any]) -> bool:
        if not self.groups:
            return True
        return any(
            all(_clause_matches(clause, name, metadata) for clause in group)
            for group in self.groups
        )


def _clause_matches(
    clause: FilterClause, name: str, metadata: Mapping[str, Any]
) -> bool:
    actual = name if clause.property == "name" else metadata.get(clause.property)
    wanted = clause.value
    if actual is None:
        return clause.operator in (FilterOperator.ne, FilterOperator.not_like)
    match clause.operator:
        case FilterOperator.eq:
            return _text(actual) == _text(wanted)
        case FilterOperator.ne:
            return _text(actual) != _text(wanted)
        case FilterOperator.like:
            return str(wanted).lower() in str(actual).lower()
        case FilterOperator.not_like:
            return str(wanted).lower() not in str(actual).lower()
    left, right = _number(actual), _number(wanted)
    if left is None or right is None:
        return False
    match clause.operator:
        case FilterOperator.gt:
            return left > right
        case FilterOperator.gte:
            return left >= right
        case FilterOperator.lt:
            return left < right
        case FilterOperator.lte:
            return left <= right
