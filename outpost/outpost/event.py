from pydantic import AwareDatetime, BaseModel, Field


class EventCreate(BaseModel):
    timestamp: AwareDatetime
    name: str
    external_customer_id: str
    external_id: str | None = None
    external_member_id: str | None = None
    metadata: dict[str, str | int | float | bool] = Field(default_factory=dict)


class EventsIngest(BaseModel):
    events: list[EventCreate]
