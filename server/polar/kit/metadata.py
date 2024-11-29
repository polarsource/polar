import inspect
from typing import Annotated, Any

from pydantic import AliasChoices, BaseModel, Field, StringConstraints
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class MetadataMixin:
    user_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )


_MAXIMUM_KEYS = 50
_MINIMUM_KEY_LENGTH = 1
_MAXIMUM_KEY_LENGTH = 40
_MINIMUM_VALUE_LENGTH = 1
_MAXIMUM_VALUE_LENGTH = 500
_MetadataKey = Annotated[
    str,
    StringConstraints(min_length=_MINIMUM_KEY_LENGTH, max_length=_MAXIMUM_KEY_LENGTH),
]
_MetadataValueString = Annotated[
    str,
    StringConstraints(
        min_length=_MINIMUM_VALUE_LENGTH, max_length=_MAXIMUM_VALUE_LENGTH
    ),
]
_MetadataValue = _MetadataValueString | int | bool
_description = inspect.cleandoc(
    f"""
    Key-value object allowing you to store additional information.

    The key must be a string with a maximum length of **{_MAXIMUM_KEY_LENGTH} characters**.
    The value must be either:

    * A string with a maximum length of **{_MAXIMUM_VALUE_LENGTH} characters**
    * An integer
    * A boolean

    You can store up to **{_MAXIMUM_KEYS} key-value pairs**.
    """
)


class MetadataInputMixin(BaseModel):
    metadata: dict[_MetadataKey, _MetadataValue] = Field(
        default_factory=dict,
        max_length=_MAXIMUM_KEYS,
        description=_description,
        serialization_alias="user_metadata",
    )


class OptionalMetadataInputMixin(BaseModel):
    metadata: dict[_MetadataKey, _MetadataValue] | None = Field(
        default=None,
        max_length=_MAXIMUM_KEYS,
        description=_description,
        serialization_alias="user_metadata",
    )


class MetadataOutputMixin(BaseModel):
    metadata: dict[str, str | int | bool] = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )
