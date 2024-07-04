import dataclasses
import json
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    GetJsonSchemaHandler,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import PydanticCustomError, core_schema

from .email import EmailNotValidError, validate_email


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampedSchema(Schema):
    created_at: datetime = Field(..., description="Creation timestamp of the object.")
    modified_at: datetime | None = Field(
        None, description="Last modification timestamp of the object."
    )


def _empty_str_to_none(value: str | None) -> str | None:
    if isinstance(value, str):
        stripped_value = value.strip()
        if stripped_value == "":
            return None
        return stripped_value
    return value


EmptyStrToNoneValidator = AfterValidator(_empty_str_to_none)
EmptyStrToNone = Annotated[str | None, EmptyStrToNoneValidator]


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


@dataclasses.dataclass(slots=True)
class MergeJSONSchema:
    json_schema: JsonSchemaValue
    mode: Literal["validation", "serialization"] | None = None

    def __get_pydantic_json_schema__(
        self, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        mode = self.mode or handler.mode
        json_schema = handler(core_schema)
        if mode != handler.mode:
            return json_schema
        return {**json_schema, **self.json_schema}

    def __hash__(self) -> int:
        return hash(type(self.mode))


@dataclasses.dataclass(slots=True)
class SelectorWidget:
    resource_root: str
    resource_name: str
    display_property: str

    def __get_pydantic_json_schema__(
        self, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        return {**json_schema, **self._get_extra_attributes()}

    def _get_extra_attributes(self) -> dict[str, Any]:
        return {
            "x-polar-selector-widget": {
                "resourceRoot": self.resource_root,
                "resourceName": self.resource_name,
                "displayProperty": self.display_property,
            }
        }

    def __hash__(self) -> int:
        return hash(json.dumps(self._get_extra_attributes()))
