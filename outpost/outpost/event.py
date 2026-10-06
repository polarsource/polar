import typing

from pydantic import AwareDatetime, BaseModel, Field


class EventCreate(BaseModel):
    timestamp: AwareDatetime
    name: str
    external_customer_id: str
    external_id: str | None = None
    external_member_id: str | None = None
    metadata: dict[str, str | int | float | bool] = Field(default_factory=dict)

    def get_property(self, property: str) -> typing.Any:
        try:
            return getattr(self, property)
        except AttributeError:
            return self.metadata.get(property)


class EventsIngest(BaseModel):
    events: list[EventCreate]
