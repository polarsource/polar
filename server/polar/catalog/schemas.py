from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.models.catalog import CatalogStatus
from polar.organization.schemas import OrganizationID


class Catalog(IDSchema, TimestampedSchema):
    """A version of an organization's product catalog."""

    organization_id: OrganizationID
    name: str | None = Field(
        description=(
            "Name given when it was published. Defaults to `v{n}`, n being its "
            "position in the organization's catalog history."
        )
    )
    parent_id: UUID4 | None = Field(
        description="ID of the catalog this version replaced. Null for the first one."
    )
    status: CatalogStatus = Field(
        description=(
            "`live` for the catalog new checkouts use, `archived` for previous "
            "versions, `draft` for unpublished changes."
        )
    )
    published_at: datetime | None = Field(
        description="When the catalog was published. Null for drafts."
    )
    customers: int = Field(
        description=(
            "Customers with an active subscription to a product of this catalog, "
            "counted on the newest catalog that still contains it."
        )
    )
