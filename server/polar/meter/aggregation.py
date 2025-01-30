from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Discriminator, TypeAdapter
from sqlalchemy import ColumnExpressionArgument, Dialect, TypeDecorator, func, true
from sqlalchemy.dialects.postgresql import JSONB


class AggregationFunction(StrEnum):
    cnt = "count"  # `count` is a reserved keyword, so we use `cnt` as key
    sum = "sum"
    max = "max"
    min = "min"
    avg = "avg"


class CountAggregation(BaseModel):
    function: Literal[AggregationFunction.cnt] = AggregationFunction.cnt

    def get_sql_column(self, model: type[Any]) -> Any:
        return func.count()

    def get_sql_clause(self, model: type[Any]) -> ColumnExpressionArgument[bool]:
        return true()


class FieldAggregation(BaseModel):
    function: Literal[
        AggregationFunction.sum,
        AggregationFunction.max,
        AggregationFunction.min,
        AggregationFunction.avg,
    ]
    field: str

    def get_sql_column(self, model: type[Any]) -> Any:
        try:
            attr = getattr(model, self.field)
        except AttributeError:
            attr = model.user_metadata[self.field].as_integer()
        if self.function == AggregationFunction.sum:
            return func.sum(attr)
        elif self.function == AggregationFunction.max:
            return func.max(attr)
        elif self.function == AggregationFunction.min:
            return func.min(attr)
        elif self.function == AggregationFunction.avg:
            return func.avg(attr)
        raise ValueError(f"Unsupported aggregation type: {self.function}")

    def get_sql_clause(self, model: type[Any]) -> ColumnExpressionArgument[bool]:
        try:
            getattr(model, self.field)
            return true()
        except AttributeError:
            return func.jsonb_typeof(model.user_metadata[self.field]) == "number"


_Aggregation = CountAggregation | FieldAggregation
Aggregation = Annotated[_Aggregation, Discriminator("function")]
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
