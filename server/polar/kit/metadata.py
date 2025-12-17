import inspect
import re
from typing import Annotated, Any

from fastapi import Depends, Request
from pydantic import AliasChoices, BaseModel, Field, StringConstraints
from sqlalchemy import ColumnExpressionArgument, Select, and_, or_, true
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

MetadataColumn = Annotated[
    dict[str, Any], mapped_column(JSONB, nullable=False, default=dict)
]


class MetadataMixin:
    user_metadata: Mapped[MetadataColumn]


MAXIMUM_KEYS = 50
_MINIMUM_KEY_LENGTH = 1
_MAXIMUM_KEY_LENGTH = 40
_MINIMUM_VALUE_LENGTH = 1
_MAXIMUM_VALUE_LENGTH = 500
MetadataKey = Annotated[
    str,
    StringConstraints(min_length=_MINIMUM_KEY_LENGTH, max_length=_MAXIMUM_KEY_LENGTH),
]
_MetadataValueString = Annotated[
    str,
    StringConstraints(
        min_length=_MINIMUM_VALUE_LENGTH, max_length=_MAXIMUM_VALUE_LENGTH
    ),
]
MetadataValue = _MetadataValueString | int | float | bool

METADATA_DESCRIPTION = inspect.cleandoc(
    f"""
    {{heading}}

    The key must be a string with a maximum length of **{_MAXIMUM_KEY_LENGTH} characters**.
    The value must be either:

    * A string with a maximum length of **{_MAXIMUM_VALUE_LENGTH} characters**
    * An integer
    * A floating-point number
    * A boolean

    You can store up to **{MAXIMUM_KEYS} key-value pairs**.
    """
)
_description = METADATA_DESCRIPTION.format(
    heading="Key-value object allowing you to store additional information."
)


MetadataField = Annotated[
    dict[MetadataKey, MetadataValue],
    Field(max_length=MAXIMUM_KEYS, description=_description),
]


class MetadataInputMixin(BaseModel):
    metadata: MetadataField = Field(
        default_factory=dict, serialization_alias="user_metadata"
    )


type MetadataOutputType = dict[str, str | int | float | bool]


class MetadataOutputMixin(BaseModel):
    metadata: MetadataOutputType = Field(
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


def get_metadata_clause[M: MetadataMixin](
    model: type[M], query: MetadataQuery
) -> ColumnExpressionArgument[bool]:
    clauses: list[ColumnExpressionArgument[bool]] = []
    for key, values in query.items():
        sub_clauses: list[ColumnExpressionArgument[bool]] = []
        for value in values:
            sub_clauses.append(model.user_metadata[key].as_string() == value)
        clauses.append(or_(*sub_clauses))

    if not clauses:
        return true()

    return and_(*clauses)


def apply_metadata_clause[M: MetadataMixin](
    model: type[M], statement: Select[tuple[M]], query: MetadataQuery
) -> Select[tuple[M]]:
    clause = get_metadata_clause(model, query)
    return statement.where(clause)


def extract_metadata_value(
    metadata: dict[str, Any], property_selector: str
) -> str | None:
    """
    Extract a value from metadata using a property selector.

    Supports:
    - Simple keys: "subject" -> metadata["subject"]
    - Nested keys: "metadata.subject" -> metadata["metadata"]["subject"]
    - Dot-separated paths of any depth

    Returns the value as a string if found, None otherwise.
    """
    if not property_selector:
        return None

    keys = property_selector.split(".")
    current: Any = metadata

    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
        if current is None:
            return None

    return str(current) if current is not None else None
