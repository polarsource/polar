import typing

from pydantic import AwareDatetime, BaseModel, Field, JsonValue


class EventCreate(BaseModel):
    timestamp: AwareDatetime
    name: str
    external_customer_id: str
    external_id: str | None = None
    external_member_id: str | None = None
    metadata: dict[str, JsonValue] = Field(default_factory=dict)

    def get_property(self, property: str) -> typing.Any:
        match property:
            case "timestamp":
                return int(self.timestamp.timestamp())
            case "name":
                return self.name
            case "source":
                return "user"
            case _:
                return self.metadata.get(property)


class Actor(BaseModel):
    external_customer_id: str


class EventsIngest(BaseModel):
    events: list[EventCreate]
