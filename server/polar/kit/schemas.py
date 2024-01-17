from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedSchema(Schema):
    created_at: datetime
    modified_at: datetime | None = None


def _empty_str_to_none(value: str | None) -> str | None:
    if value == "":
        return None
    return value


EmptyStrToNone = Annotated[str | None, AfterValidator(_empty_str_to_none)]
