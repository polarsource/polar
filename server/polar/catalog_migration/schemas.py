from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, ConfigDict, Field

from polar.kit.schemas import (
    PRODUCT_ID_EXAMPLE,
    IDSchema,
    MultipleQueryFilter,
    Schema,
    TimestampedSchema,
)
from polar.kit.versioning import QuerySchema
from polar.models.catalog_migration import CatalogMigrationStatus
from polar.organization.schemas import OrganizationID
from polar.product.schemas import ProductID

MAXIMUM_SOURCE_PRODUCTS = 100

CatalogMigrationID = Annotated[UUID4, Path(description="The catalog migration ID.")]


class CatalogMigrationCreate(Schema):
    model_config = ConfigDict(extra="forbid")

    source_product_ids: list[UUID4] = Field(
        min_length=1,
        max_length=MAXIMUM_SOURCE_PRODUCTS,
        description=(
            "IDs of the product versions customers move from. "
            "Each one must be another version of the target product."
        ),
        examples=[[PRODUCT_ID_EXAMPLE]],
    )
    target_product_id: UUID4 = Field(
        description=(
            "ID of the product version customers move to. "
            "Must be the current version of the product."
        ),
        examples=[PRODUCT_ID_EXAMPLE],
    )


class CatalogMigration(IDSchema, TimestampedSchema):
    """
    A request to move the customers of older versions of a product to its
    current version.

    Subscriptions move in the background, each one at its next renewal.
    """

    organization_id: UUID4 = Field(description="The organization ID.")
    source_product_ids: list[UUID4] = Field(
        description="IDs of the product versions customers move from."
    )
    target_product_id: UUID4 = Field(
        description="ID of the product version customers move to."
    )
    status: CatalogMigrationStatus = Field(
        description=(
            "`running` while customers are being handled, "
            "`completed` once every one of them was."
        )
    )
    moved_count: int = Field(
        description="Subscriptions scheduled to move at their next renewal so far."
    )
    skipped_count: int = Field(
        description="Subscriptions that couldn't move, for example on a currency mismatch."
    )
    completed_at: datetime | None = Field(
        description="When every customer was handled. `None` while running."
    )


class CatalogMigrationListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    product_id: MultipleQueryFilter[ProductID] | None = Field(
        None,
        title="ProductID Filter",
        description="Filter by product version customers move from or to.",
    )
    status: MultipleQueryFilter[CatalogMigrationStatus] | None = Field(
        None, title="Status Filter", description="Filter by status."
    )
