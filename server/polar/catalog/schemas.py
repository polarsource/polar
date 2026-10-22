from datetime import datetime

from pydantic import Field

from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.models.catalog import CatalogStatus
from polar.organization.schemas import OrganizationID


class Catalog(IDSchema, TimestampedSchema):
    """A published version of an organization's product catalog."""

    organization_id: OrganizationID
    version_hash: str | None = Field(
        description="Hash identifying this version of the catalog."
    )
    status: CatalogStatus = Field(
        description="`live` for the catalog new checkouts use, `archived` for previous versions."
    )
    published_at: datetime | None = Field(description="When the catalog was published.")
    product_count: int = Field(description="Number of products in the catalog.")
