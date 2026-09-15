from typing import Annotated, Any, ClassVar, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    Discriminator,
    Field,
    TypeAdapter,
    model_validator,
)
from sqlalchemy import Dialect, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB

from .filter import strip_metadata_prefix
from .map import compile_expression

ReducerType = Literal["scalar", "dict"]


class CountAggregation(BaseModel):
    type: ClassVar[ReducerType] = "scalar"
    func: Literal["count"] = "count"


class PropertyAggregation(BaseModel):
    type: ClassVar[ReducerType] = "scalar"
    func: Literal["sum", "max", "min"]
    property: Annotated[str, AfterValidator(strip_metadata_prefix)]


class RecordAggregation(BaseModel):
    type: ClassVar[ReducerType] = "dict"
    func: Literal["first", "last"]


class DerivedAggregation(BaseModel):
    type: ClassVar[ReducerType] = "scalar"
    func: Literal["derive"] = "derive"
    inputs: dict[Annotated[str, Field(pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")], str] = (
        Field(min_length=1)
    )
    expression: str = Field(min_length=1, max_length=4096)

    @model_validator(mode="after")
    def valid_expression(self) -> "DerivedAggregation":
        references = {
            arg for op, arg in compile_expression(self.expression) if op == "ref"
        }
        if references != set(self.inputs):
            raise ValueError("Expression references must match the named inputs")
        return self


_Aggregation = (
    CountAggregation | PropertyAggregation | RecordAggregation | DerivedAggregation
)
Aggregation = Annotated[_Aggregation, Discriminator("func")]
AggregationTypeAdapter: TypeAdapter[Aggregation] = TypeAdapter(Aggregation)


class AggregationType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, _Aggregation):
            return value.model_dump(mode="json")
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is not None:
            return AggregationTypeAdapter.validate_python(value)
        return value
