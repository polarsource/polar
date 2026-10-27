from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import UUID4, Field

from polar.declarative_config.schemas import ConfigFieldChange
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
from polar.models.catalog import CatalogStatus
from polar.organization.schemas import OrganizationID

CatalogID = Annotated[UUID4, MergeJSONSchema({"description": "The catalog ID."})]


class Catalog(IDSchema, TimestampedSchema):
    """A version of an organization's product catalog."""

    organization_id: OrganizationID
    name: str | None = Field(description="Optional name given when it was published.")
    version_hash: str | None = Field(
        description="Hash identifying this version of the catalog."
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


class CatalogProductChange(StrEnum):
    added = "added"
    changed = "changed"
    removed = "removed"
    unchanged = "unchanged"


class CatalogProductDiff(Schema):
    external_id: str = Field(description="The product's stable name across versions.")
    name: str = Field(
        description="The product name in this version, or in the previous one when removed."
    )
    product_id: UUID4 | None = Field(
        description="The product row in this version. Null when removed."
    )
    previous_product_id: UUID4 | None = Field(
        description="The product row in the previous version. Null when added."
    )
    change: CatalogProductChange = Field(
        description="How the product differs from the previous version."
    )
    diff: list[ConfigFieldChange] = Field(
        description=(
            "Fields that changed since the previous version. Empty unless `change` "
            "is `changed`, or when a version can't be expressed as config."
        )
    )


class CatalogDetail(Catalog):
    previous_version_hash: str | None = Field(
        description=(
            "Version hash of the catalog published before this one. "
            "Null for the first version."
        )
    )
    products: list[CatalogProductDiff] = Field(
        description="The products in this version, compared with the previous one."
    )
