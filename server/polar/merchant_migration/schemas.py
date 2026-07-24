from enum import StrEnum
from typing import Any

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import MerchantMigrationRecordStatus


class MerchantMigrationCreate(Schema):
    organization_id: UUID4 = Field(
        description="The organization the migration belongs to."
    )
    source_platform: MerchantMigrationSourcePlatform = Field(
        description="The provider to migrate the billing from.",
    )
    api_key: str = Field(
        min_length=1,
        pattern=r"^(rk|sk)_",
        description=(
            "A Stripe API key for the source account (a restricted `rk_...` key is "
            "recommended). It is validated for all required permissions before the "
            "migration is saved."
        ),
    )


class PrecheckIssueLevel(StrEnum):
    blocker = "blocker"
    warning = "warning"


class PrecheckIssue(Schema):
    level: PrecheckIssueLevel
    code: str
    message: str
    source_id: str | None


class PrecheckEntity(StrEnum):
    products = "products"
    prices = "prices"
    customers = "customers"
    subscriptions = "subscriptions"


class PrecheckRecordStatus(StrEnum):
    importable = "importable"
    skipped = "skipped"


class PrecheckEntitySummary(Schema):
    entity: PrecheckEntity = Field(description="The source entity type.")
    total: int = Field(description="How many were read from the source.")
    importable: int = Field(description="How many will be imported into Polar.")
    skipped: int = Field(
        description="How many won't be imported and stay on the source."
    )


class PrecheckReport(Schema):
    can_start: bool
    issues: list[PrecheckIssue]
    entities: list[PrecheckEntitySummary] = Field(
        description="Per-entity counts of what will be imported vs stay on the source."
    )


class MerchantMigrationRecordItem(Schema):
    record_id: UUID4 | None = Field(
        description=(
            "The ledger record id, used to select this row for import. Null for "
            "price rows, which are imported together with their product."
        ),
    )
    entity: PrecheckEntity = Field(description="The source entity type.")
    source_id: str = Field(description="The source identifier (e.g. Stripe `sub_…`).")
    title: str = Field(description="Primary label (name, email or product).")
    subtitle: str | None = Field(
        description="Secondary detail (lifecycle status, country)."
    )
    amount: int | None = Field(
        description="Recurring price in minor units (cents), for priced rows.",
    )
    currency: str | None = Field(description="ISO currency for `amount`.")
    recurring_interval: str | None = Field(
        description="Billing interval for `amount` (e.g. `month`, `year`).",
    )
    status: PrecheckRecordStatus = Field(
        description="Whether this record will be imported or stays on the source."
    )
    import_status: MerchantMigrationRecordStatus | None = Field(
        description=(
            "The ledger status of this record: `pending` (not imported yet), "
            "`imported`, `skipped` or `failed`. Null for price rows, which import "
            "with their product."
        ),
    )
    reason: str | None = Field(description="Why the record is skipped, if it is.")
    reason_code: str | None = Field(
        description="Stable code for the skip reason, if any."
    )


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
