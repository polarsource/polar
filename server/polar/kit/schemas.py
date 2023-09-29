from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedSchema(Schema):
    created_at: datetime
    modified_at: datetime | None = None
