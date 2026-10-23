from datetime import datetime
from typing import Literal

from pydantic import Field

from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.models.catalog import CatalogStatus
from polar.organization.schemas import OrganizationID


class Catalog(IDSchema, TimestampedSchema):
    """A published version of an organization's product catalog."""

    organization_id: OrganizationID
    name: str | None = Field(description="Optional name given when it was published.")
    version_hash: str = Field(
        description="Hash identifying this version of the catalog."
    )
    status: Literal[CatalogStatus.live, CatalogStatus.archived] = Field(
        description="`live` for the catalog new checkouts use, `archived` for previous versions."
    )
    published_at: datetime = Field(description="When the catalog was published.")
