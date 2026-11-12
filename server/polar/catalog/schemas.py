from datetime import datetime
from enum import StrEnum

from pydantic import UUID4, AwareDatetime, Field

from polar.kit.schemas import IDSchema, MultipleQueryFilter, Schema, TimestampedSchema
from polar.kit.versioning import QuerySchema
from polar.models.catalog import CatalogStatus
from polar.organization.schemas import OrganizationID


class CatalogChanges(Schema):
    """How a catalog differs from its parent, in products and benefits."""

    added_count: int = Field(description="Keys the parent doesn't list.")
    changed_count: int = Field(description="Keys listed with a new version.")
    removed_count: int = Field(
        description="Keys the parent lists but this catalog doesn't."
    )


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
    changes: CatalogChanges | None = Field(
        description="What changed since the parent catalog. Null for the first one."
    )


class CatalogProduct(Schema):
    external_id: str = Field(description="Key of the product in the catalog.")
    product_id: UUID4 = Field(description="The product version in this catalog.")


class CatalogBenefit(Schema):
    external_id: str = Field(description="Key of the benefit in the catalog.")
    benefit_id: UUID4 = Field(description="The benefit version in this catalog.")


class CatalogVersion(Catalog):
    """A catalog version with its products and benefits."""

    products: list[CatalogProduct] = Field(
        validation_alias="product_members",
        description="The products in this version, ordered by key.",
    )
    benefits: list[CatalogBenefit] = Field(
        validation_alias="benefit_members",
        description="The benefits in this version, ordered by key.",
    )


class RemovedCatalogItemResource(StrEnum):
    product = "product"
    benefit = "benefit"


class RemovedCatalogItemStatus(StrEnum):
    deprecated = "deprecated"
    removed = "removed"


class RemovedCatalogItemVersion(IDSchema):
    name: str | None
    published_at: datetime


class RemovedCatalogItem(Schema):
    """A key that was in a published catalog but isn't in the live one."""

    resource: RemovedCatalogItemResource
    external_id: str = Field(description="Key of the item in the catalogs.")
    name: str = Field(description="Name of the item in its last version.")
    status: RemovedCatalogItemStatus = Field(
        description=(
            "`deprecated` while customers still use it, `removed` once nobody does."
        )
    )
    customers_count: int = Field(
        description=(
            "Customers with a billable subscription on, or a scheduled change to, "
            "the product; customers granted the benefit."
        )
    )
    last_item_id: UUID4 = Field(
        description="ID of the product or benefit in the last catalog that listed it."
    )
    first_catalog: RemovedCatalogItemVersion = Field(
        description="First catalog that listed it."
    )
    last_catalog: RemovedCatalogItemVersion = Field(
        description="Last catalog that listed it."
    )
    removed_in_catalog: RemovedCatalogItemVersion = Field(
        description="The catalog published after the last one that listed it."
    )


class RemovedCatalogItemsParams(QuerySchema):
    organization_id: OrganizationID


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
