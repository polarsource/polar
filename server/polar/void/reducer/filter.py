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
