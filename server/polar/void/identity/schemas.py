from datetime import datetime
from typing import Any

from pydantic import AliasChoices, Field

from polar.kit.schemas import IDSchema, Schema
from polar.void.customer.schemas import Customer
from polar.void.meter.schemas import Balance


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


class IdentitySnapshot(Schema):
    at: datetime
    identity: Identity
    root: Identity
    customer: Customer | None
    meters: dict[str, Balance] = Field(
        description="Current mainline meter balances, keyed by meter slug."
    )
    entitlements: list[str] = Field(
        description="Entitlement slugs held through this identity's chain."
    )
