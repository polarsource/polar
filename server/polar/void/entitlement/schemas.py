import uuid
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from polar.kit.schemas import Schema

SLUG_PATTERN = r"^[a-z0-9][a-z0-9_-]*$"


class EntitlementCreate(Schema):
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    name: str | None = Field(
        default=None, description="Display name; defaults to the slug."
    )
    description: str | None = None


class Entitlement(Schema):
    id: UUID
    slug: str
    name: str
    description: str | None
    created_at: datetime


class EntitlementGrant(Schema):
    """One held entitlement and the subscription up the chain that grants it."""

    slug: str
    name: str
    subscription_id: uuid.UUID
    product_id: uuid.UUID
    product_slug: str
    external_identity_id: str = Field(
        description="The holder in the chain whose subscription grants this."
    )


class IdentityEntitlements(Schema):
    external_identity_id: str
    at: datetime
    entitlements: list[EntitlementGrant]
    slugs: list[str] = Field(description="Held entitlement slugs, sorted, unique.")
    assignments: dict[str, "EntitlementAssignmentRead"]


class MeterEntitlement(Schema):
    """Access to an inherited meter, optionally capped in its usage units."""

    model_config = ConfigDict(extra="forbid")

    meter: str = Field(min_length=1, pattern=SLUG_PATTERN)
    cap: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class EntitlementAssignment(Schema):
    """Narrow inherited access. None inherits; an empty list denies all."""

    model_config = ConfigDict(extra="forbid")

    features: list[str] | None = None
    meters: list[MeterEntitlement] | None = None

    @model_validator(mode="after")
    def unique_resources(self) -> "EntitlementAssignment":
        if self.features is not None and len(set(self.features)) != len(self.features):
            raise ValueError("Feature entitlements must be unique")
        if self.meters is not None:
            keys = [entry.meter for entry in self.meters]
            if len(set(keys)) != len(keys):
                raise ValueError("Meter entitlements must be unique")
        return self

    def allows(self, kind: Literal["features", "meters"], slug: str) -> bool:
        entries = self.features if kind == "features" else self.meters
        return entries is None or any(
            (entry if isinstance(entry, str) else entry.meter) == slug
            for entry in entries
        )


class EntitlementUpdate(EntitlementAssignment):
    external_id: str = Field(
        min_length=1,
        max_length=255,
        description="Stable event id for retrying this assignment change.",
    )


class MeterEntitlementState(Schema):
    external_identity_id: str
    cap: float
    usage: float
    remaining: float
    period_start: datetime | None
    period_end: datetime | None


class MeterEntitlementRead(MeterEntitlement):
    cap: float | None = Field(ge=0, allow_inf_nan=False)


class EntitlementAssignmentRead(Schema):
    features: list[str] | None
    meters: list[MeterEntitlementRead] | None


IdentityEntitlements.model_rebuild()
