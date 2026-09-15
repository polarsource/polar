from pydantic import BaseModel, Field, model_validator

from .aggregation import Aggregation
from .filter import Filter
from .map import EventMap


class ReducerCreate(BaseModel):
    slug: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    filter: Filter | None = None
    aggregation: Aggregation
    map: EventMap | None = None

    @model_validator(mode="after")
    def valid_source(self) -> "ReducerCreate":
        if self.aggregation.func == "derive":
            if self.filter is not None or self.map is not None:
                raise ValueError("Derived reducers cannot have an event filter or map")
        elif self.filter is None:
            raise ValueError("Event reducers require a filter")
        return self
