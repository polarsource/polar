from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr
from pydantic_core import PydanticCustomError

from .email import EmailNotValidError, validate_email


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


def _validate_email_dns(email: str) -> str:
    try:
        validate_email(email)
    except EmailNotValidError as e:
        raise PydanticCustomError(
            "value_error",
            "value is not a valid email address: {reason}",
            {"reason": str(e)},
        ) from e
    else:
        return email


EmailStrDNS = Annotated[EmailStr, AfterValidator(_validate_email_dns)]
