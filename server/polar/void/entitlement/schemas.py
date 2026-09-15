from datetime import datetime
from uuid import UUID

from pydantic import Field

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
