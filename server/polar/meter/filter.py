from enum import StrEnum
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict
from sqlalchemy import (
    ColumnExpressionArgument,
    Dialect,
    TypeDecorator,
    and_,
    case,
    false,
    func,
    or_,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB


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
    value: str | int | bool

    def get_sql_clause(self, model: type[Any]) -> ColumnExpressionArgument[bool]:
        if self.property in model._filterable_fields:
            allowed_type, attr = model._filterable_fields[self.property]
            if not isinstance(self.value, allowed_type):
                return false()
            return self._get_comparison_clause(attr, self.value)

        attr = model.user_metadata[self.property]

        # The operator is LIKE OR NOT LIKE, treat everything as a string
        if self.operator in (FilterOperator.like, FilterOperator.not_like):
            return self._get_comparison_clause(attr.as_string(), self._get_str_value())

        return case(
            # The property is a string, compare it with the value as a string
            (
                func.jsonb_typeof(attr) == "string",
                self._get_comparison_clause(attr.as_string(), self._get_str_value()),
            ),
            # The property is a number
            (
                func.jsonb_typeof(attr) == "number",
                # Compare it with the value if it's an integer
                self._get_comparison_clause(attr.as_integer(), self.value)
                if isinstance(self.value, int)
                # Otherwise return false
                else false(),
            ),
            # The property is a boolean
            (
                func.jsonb_typeof(attr) == "boolean",
                # Compare it with the value if it's a boolean
                self._get_comparison_clause(attr.as_boolean(), self.value)
                if isinstance(self.value, bool)
                # Otherwise return false
                else false(),
            ),
        )

    def _get_comparison_clause(self, attr: Any, value: str | int | bool) -> Any:
        if self.operator == FilterOperator.eq:
            return attr == value
        elif self.operator == FilterOperator.ne:
            return attr != value
        elif self.operator == FilterOperator.gt:
            return attr > value
        elif self.operator == FilterOperator.gte:
            return attr >= value
        elif self.operator == FilterOperator.lt:
            return attr < value
        elif self.operator == FilterOperator.lte:
            return attr <= value
        elif self.operator == FilterOperator.like:
            return attr.like(f"%{value}%")
        elif self.operator == FilterOperator.not_like:
            return attr.notlike(f"%{value}%")
        raise ValueError(f"Unsupported operator: {self.operator}")

    def _get_str_value(self) -> str:
        if isinstance(self.value, bool):
            return "t" if self.value else "f"
        return str(self.value)


class FilterConjunction(StrEnum):
    and_ = "and"
    or_ = "or"


class Filter(BaseModel):
    conjunction: FilterConjunction
    clauses: list["FilterClause | Filter"]

    model_config = ConfigDict(
        # IMPORTANT: this ensures FastAPI doesn't generate `-Input` for output schemas
        json_schema_mode_override="serialization",
    )

    def get_sql_clause(self, model: type[Any]) -> ColumnExpressionArgument[bool]:
        sql_clauses: list[ColumnExpressionArgument[bool]] = [
            clause.get_sql_clause(model) for clause in self.clauses
        ]
        conjunction = and_ if self.conjunction == FilterConjunction.and_ else or_
        return conjunction(*sql_clauses or (true(),))


class FilterType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, Filter):
            return value.model_dump()
        return value

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is not None:
            return Filter.model_validate(value)
        return value
