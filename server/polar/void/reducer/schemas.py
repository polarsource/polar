from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, computed_field, model_validator

from polar.kit.schemas import Schema

from .aggregation import Aggregation, ReducerType
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


class Reducer(Schema):
    id: UUID
    created_at: datetime
    slug: str
    filter: Filter | None
    aggregation: Aggregation
    map: EventMap | None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def type(self) -> ReducerType:
        return self.aggregation.type


class ReducerRecord(Schema):
    external_identity_id: str | None
    timestamp: datetime
    data: dict[str, Any]
