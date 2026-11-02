from datetime import datetime

from pydantic import UUID4, AwareDatetime, Field

from polar.kit.schemas import IDSchema, MultipleQueryFilter, Schema, TimestampedSchema
from polar.kit.versioning import QuerySchema
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


class CatalogProduct(Schema):
    external_id: str = Field(description="Key of the product in the catalog.")
    product_id: UUID4 = Field(description="The product version in this catalog.")


class CatalogVersion(Catalog):
    """A catalog version with its products."""

    products: list[CatalogProduct] = Field(
        validation_alias="product_members",
        description="The products in this version, ordered by key.",
    )


class CatalogListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    status: MultipleQueryFilter[CatalogStatus] | None = Field(
        None, title="Status Filter", description="Filter by catalog status."
    )
    published_after: AwareDatetime | None = Field(
        None,
        description=(
            "Only include catalogs published after this date. "
            "Must include a UTC offset."
        ),
    )
    published_before: AwareDatetime | None = Field(
        None,
        description=(
            "Only include catalogs published before this date. "
            "Must include a UTC offset."
        ),
    )
