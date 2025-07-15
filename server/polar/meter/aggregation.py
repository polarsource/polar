from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, Discriminator, TypeAdapter
from sqlalchemy import (
    ColumnExpressionArgument,
    Dialect,
    TypeDecorator,
    false,
    func,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB


class AggregationFunction(StrEnum):
    cnt = "count"  # `count` is a reserved keyword, so we use `cnt` as key
    sum = "sum"
    max = "max"
    min = "min"
    avg = "avg"


class CountAggregation(BaseModel):
    func: Literal[AggregationFunction.cnt] = AggregationFunction.cnt

    def get_sql_column(self, model: type[Any]) -> Any:
        return func.count(model.id)

    def get_sql_clause(self, model: type[Any]) -> ColumnExpressionArgument[bool]:
        return true()


def _strip_metadata_prefix(value: str) -> str:
    prefix = "metadata."
    return value[len(prefix) :] if value.startswith(prefix) else value


class PropertyAggregation(BaseModel):
    func: Literal[
        AggregationFunction.sum,
        AggregationFunction.max,
        AggregationFunction.min,
        AggregationFunction.avg,
    ]
    property: Annotated[str, AfterValidator(_strip_metadata_prefix)]

    def get_sql_column(self, model: type[Any]) -> Any:
        if self.property in model._filterable_fields:
            _, attr = model._filterable_fields[self.property]

        attr = model.user_metadata[self.property].as_float()

        if self.func == AggregationFunction.sum:
            return func.sum(attr)
        elif self.func == AggregationFunction.max:
            return func.max(attr)
        elif self.func == AggregationFunction.min:
            return func.min(attr)
        elif self.func == AggregationFunction.avg:
            return func.avg(attr)
        raise ValueError(f"Unsupported aggregation function: {self.func}")

    def get_sql_clause(self, model: type[Any]) -> ColumnExpressionArgument[bool]:
        if self.property in model._filterable_fields:
            allowed_type, _ = model._filterable_fields[self.property]
            return true() if allowed_type is int else false()

        return func.jsonb_typeof(model.user_metadata[self.property]) == "number"


_Aggregation = CountAggregation | PropertyAggregation
Aggregation = Annotated[_Aggregation, Discriminator("func")]
AggregationTypeAdapter: TypeAdapter[Aggregation] = TypeAdapter(Aggregation)


class AggregationType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, _Aggregation):
            return value.model_dump()
        return value

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is not None:
            return AggregationTypeAdapter.validate_python(value)
        return value
