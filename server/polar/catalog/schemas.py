from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
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
        description="The catalog version this one was published on top of."
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


class CatalogProduct(Schema):
    external_id: str = Field(description="Key of the product in the catalog.")
    product_id: UUID4 = Field(description="The product version in this catalog.")


class CatalogVersion(Catalog):
    """A catalog version with its products."""

    products: list[CatalogProduct] = Field(
        description="The products in this version, ordered by key."
    )
