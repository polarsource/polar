import inspect
import re
from typing import Annotated, Any, TypeVar

from fastapi import Depends, Request
from pydantic import AliasChoices, BaseModel, Field, StringConstraints
from sqlalchemy import Select, or_
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

MetadataColumn = Annotated[
    dict[str, Any], mapped_column(JSONB, nullable=False, default=dict)
]


class MetadataMixin:
    user_metadata: Mapped[MetadataColumn]


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
_MetadataValue = _MetadataValueString | int | float | bool

METADATA_DESCRIPTION = inspect.cleandoc(
    f"""
    {{heading}}

    The key must be a string with a maximum length of **{_MAXIMUM_KEY_LENGTH} characters**.
    The value must be either:

    * A string with a maximum length of **{_MAXIMUM_VALUE_LENGTH} characters**
    * An integer
    * A floating-point number
    * A boolean

    You can store up to **{_MAXIMUM_KEYS} key-value pairs**.
    """
)
_description = METADATA_DESCRIPTION.format(
    heading="Key-value object allowing you to store additional information."
)


MetadataField = Annotated[
    dict[_MetadataKey, _MetadataValue],
    Field(max_length=_MAXIMUM_KEYS, description=_description),
]


class MetadataInputMixin(BaseModel):
    metadata: MetadataField = Field(
        default_factory=dict, serialization_alias="user_metadata"
    )


class MetadataOutputMixin(BaseModel):
    metadata: dict[str, str | int | float | bool] = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


def add_metadata_query_schema(openapi_schema: dict[str, Any]) -> dict[str, Any]:
    openapi_schema["components"]["schemas"]["MetadataQuery"] = {
        "anyOf": [
            {
                "type": "object",
                "additionalProperties": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "integer"},
                        {"type": "boolean"},
                        {"type": "array", "items": {"type": "string"}},
                        {"type": "array", "items": {"type": "integer"}},
                        {"type": "array", "items": {"type": "boolean"}},
                    ]
                },
            },
            {"type": "null"},
        ],
        "title": "MetadataQuery",
    }
    return openapi_schema


def get_metadata_query_openapi_schema() -> dict[str, Any]:
    return {
        "name": "metadata",
        "in": "query",
        "required": False,
        "style": "deepObject",
        "schema": {
            "$ref": "#/components/schemas/MetadataQuery",
        },
        "description": (
            "Filter by metadata key-value pairs. "
            "It uses the `deepObject` style, e.g. `?metadata[key]=value`."
        ),
    }


_metadata_pattern = r"metadata\[([^\]]+)\]"


def _get_metadata_query(request: Request) -> dict[str, list[str]] | None:
    query_params = request.query_params
    metadata: dict[str, list[str]] = {}

    for key, value in query_params.multi_items():
        if match := re.match(_metadata_pattern, key):
            metadata_key = match.group(1)
            try:
                metadata[metadata_key] = [*metadata[metadata_key], value]
            except KeyError:
                metadata[metadata_key] = [value]

    return metadata


MetadataQuery = Annotated[dict[str, list[str]], Depends(_get_metadata_query)]

M = TypeVar("M", bound=MetadataMixin)


def apply_metadata_clause(
    model: type[M], statement: Select[tuple[M]], query: MetadataQuery
) -> Select[tuple[M]]:
    for key, values in query.items():
        clauses = []
        for value in values:
            clauses.append(model.user_metadata[key].astext == value)
        statement = statement.where(or_(*clauses))
    return statement
