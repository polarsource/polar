from datetime import datetime

from pydantic import Field

from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.models.catalog import CatalogStatus
from polar.organization.schemas import OrganizationID


class Catalog(IDSchema, TimestampedSchema):
    """A version of an organization's product catalog."""

    organization_id: OrganizationID
    name: str | None = Field(description="Optional name given when it was published.")
    status: CatalogStatus = Field(
        description=(
            "`live` for the catalog new checkouts use, `archived` for previous "
            "versions, `draft` for unpublished changes."
        )
    )
    published_at: datetime | None = Field(
        description="When the catalog was published. Null for drafts."
    )
