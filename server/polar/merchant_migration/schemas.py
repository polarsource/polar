from enum import StrEnum
from typing import Any

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)


class MerchantMigrationCreate(Schema):
    organization_id: UUID4 = Field(
        description="The organization the migration belongs to."
    )
    source_platform: MerchantMigrationSourcePlatform = Field(
        description="The provider to migrate the billing from.",
    )


class PrecheckIssueLevel(StrEnum):
    blocker = "blocker"
    warning = "warning"


class PrecheckIssue(Schema):
    level: PrecheckIssueLevel
    code: str
    message: str
    source_id: str | None


class PrecheckReport(Schema):
    can_start: bool
    issues: list[PrecheckIssue]


class MerchantMigration(IDSchema, TimestampedSchema):
    organization_id: UUID4
    source_platform: MerchantMigrationSourcePlatform = Field(
        description="The provider the billing is being migrated from."
    )
    step: MerchantMigrationStep = Field(
        description="The current step of the migration."
    )
    source_connected: bool = Field(
        description="Whether the source provider has been connected."
    )
    source: dict[str, Any] | None = Field(
        description=(
            "Non-secret metadata about the connected source. The shape varies by "
            "provider (e.g. Stripe exposes `stripe_user_id`, `livemode`)."
        ),
    )
