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


class PrecheckReasonLevel(StrEnum):
    action_required = "action_required"
    info = "info"


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
        description=(
            "Recurring price in the currency's smallest unit (cents for USD), for "
            "priced rows."
        ),
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
    reason: str | None = Field(
        description="Why the record is skipped, or what to know about it if it isn't."
    )
    reason_code: str | None = Field(description="Stable code for `reason`, if any.")
    reason_level: PrecheckReasonLevel | None = Field(
        description=(
            "How urgent `reason` is: `action_required` when the merchant has to "
            "fix something, `info` when there is nothing to fix. Null without a "
            "reason."
        )
    )


class MerchantMigrationCounts(Schema):
    """Everything the review page needs to draw its tabs and totals, in one call."""

    entities: list[PrecheckEntitySummary] = Field(
        description="Per-entity counts, for products, customers and subscriptions."
    )
    action_required: int = Field(
        description="How many records the merchant has to act on."
    )
    blockers: list[PrecheckIssue] = Field(
        description=(
            "What stops the import right now, re-checked against the "
            "organization and the source account. Empty when it can run."
        )
    )


class MerchantMigrationImportRequest(Schema):
    record_ids: list[UUID4] | None = Field(
        default=None,
        description=(
            "The ledger record ids to import (from the records listing). When "
            "omitted, every importable record is imported (subject to "
            "`exclude_record_ids`). Records not selected stay pending."
        ),
    )
    exclude_record_ids: list[UUID4] | None = Field(
        default=None,
        description=(
            "Import every importable record except these — the opt-out selection "
            "for large catalogs. Ignored when `record_ids` is set."
        ),
    )


class MerchantMigrationImportResult(Schema):
    entity: PrecheckEntity = Field(description="The source entity type.")
    imported: int = Field(description="How many were created or reused in Polar.")
    skipped: int = Field(
        description="How many were left on the source (not importable)."
    )


class MerchantMigrationImportReport(Schema):
    step: MerchantMigrationStep = Field(
        description="The migration step after the import."
    )
    results: list[MerchantMigrationImportResult] = Field(
        description="Per-entity counts of what was imported vs skipped."
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
