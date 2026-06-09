# Source: server/polar/meter/aggregation.py (Python matching logic; SQL evaluation removed)
from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, Literal

from pydantic import AfterValidator, BaseModel, Discriminator, TypeAdapter

from polar.kit.metadata import get_nested_metadata_value

if TYPE_CHECKING:
    from polar.meter.event import BufferedEvent as Event


class AggregationFunction(StrEnum):
    cnt = "count"  # `count` is a reserved keyword, so we use `cnt` as key
    sum = "sum"
    max = "max"
    min = "min"
    avg = "avg"
    unique = "unique"


class CountAggregation(BaseModel):
    func: Literal[AggregationFunction.cnt] = AggregationFunction.cnt

    def is_summable(self) -> bool:
        return True

    def matches(self, event: Event) -> bool:
        return True


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

    def is_summable(self) -> bool:
        return self.func == AggregationFunction.sum

    def matches(self, event: Event) -> bool:
        if self.property in ("name", "source", "timestamp"):
            return True
        value = get_nested_metadata_value(event.user_metadata, self.property)
        return isinstance(value, int | float)


class UniqueAggregation(BaseModel):
    func: Literal[AggregationFunction.unique] = AggregationFunction.unique
    property: Annotated[str, AfterValidator(_strip_metadata_prefix)]

    def is_summable(self) -> bool:
        return False

    def matches(self, event: Event) -> bool:
        return True


_Aggregation = CountAggregation | PropertyAggregation | UniqueAggregation
Aggregation = Annotated[_Aggregation, Discriminator("func")]
AggregationTypeAdapter: TypeAdapter[Aggregation] = TypeAdapter(Aggregation)
