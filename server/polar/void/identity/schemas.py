from datetime import datetime
from typing import Any

from pydantic import AliasChoices, Field

from polar.kit.schemas import IDSchema, Schema


class IdentityCreate(Schema):
    external_id: str = Field(min_length=1, max_length=255)
    parent_external_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="Parent for a new identity. Existing identities keep their parent.",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class Identity(IDSchema):
    external_id: str
    parent_external_id: str | None
    metadata: dict[str, Any] = Field(
        validation_alias=AliasChoices("metadata_", "metadata")
    )
    created_at: datetime


class IdentityDetail(Identity):
    chain: list[str] = Field(description="External IDs from this identity to its root.")
    children: list[Identity]
