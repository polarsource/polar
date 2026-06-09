# Source: server/polar/meter/filter.py (Python matching logic; SQL evaluation removed)
from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, Any

from annotated_types import Ge, Le, MaxLen
from pydantic import AfterValidator, BaseModel, ConfigDict

from polar.kit.metadata import get_nested_metadata_value

if TYPE_CHECKING:
    from polar.meter.event import BufferedEvent as Event


# PostgreSQL int4 range limits
INT_MIN_VALUE = -2_147_483_648
INT_MAX_VALUE = 2_147_483_647

# String length limit for filtering values
MAX_STRING_LENGTH = 1000


class FilterOperator(StrEnum):
    eq = "eq"
    ne = "ne"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    like = "like"
    not_like = "not_like"


def _strip_metadata_prefix(value: str) -> str:
    prefix = "metadata."
    return value[len(prefix) :] if value.startswith(prefix) else value


class FilterClause(BaseModel):
    property: Annotated[str, AfterValidator(_strip_metadata_prefix)]
    operator: FilterOperator
    value: (
        Annotated[str, MaxLen(MAX_STRING_LENGTH)]
        | Annotated[int, Ge(INT_MIN_VALUE), Le(INT_MAX_VALUE)]
        | bool
    )

    def matches(self, event: Event) -> bool:
        if self.property == "name":
            if not isinstance(self.value, str):
                return False
            actual_value: Any = event.name
        elif self.property == "source":
            if not isinstance(self.value, str):
                return False
            actual_value = event.source
        elif self.property == "timestamp":
            if not isinstance(self.value, int):
                return False
            actual_value = int(event.timestamp.timestamp())
        else:
            actual_value = get_nested_metadata_value(event.user_metadata, self.property)
            if actual_value is None:
                return False

        return self._compare(actual_value, self.value)

    def _compare(self, actual: Any, expected: str | int | bool) -> bool:
        try:
            if self.operator == FilterOperator.eq:
                return actual == expected
            elif self.operator == FilterOperator.ne:
                return actual != expected
            elif self.operator == FilterOperator.gt:
                return actual > expected
            elif self.operator == FilterOperator.gte:
                return actual >= expected
            elif self.operator == FilterOperator.lt:
                return actual < expected
            elif self.operator == FilterOperator.lte:
                return actual <= expected
            elif self.operator == FilterOperator.like:
                return str(expected) in str(actual)
            elif self.operator == FilterOperator.not_like:
                return str(expected) not in str(actual)
            return False
        except TypeError:
            return False


class FilterConjunction(StrEnum):
    and_ = "and"
    or_ = "or"


class Filter(BaseModel):
    conjunction: FilterConjunction
    clauses: list[FilterClause | Filter]

    model_config = ConfigDict(
        # IMPORTANT: this ensures FastAPI doesn't generate `-Input` for output schemas
        json_schema_mode_override="serialization",
    )

    def matches(self, event: Event) -> bool:
        results = [clause.matches(event) for clause in self.clauses]
        if self.conjunction == FilterConjunction.and_:
            return all(results) if results else True
        return any(results) if results else True
