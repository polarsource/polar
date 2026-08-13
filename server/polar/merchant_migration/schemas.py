from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import MerchantMigrationRecordStatus

from .pan_transfer import PanTransferMethod, PanTransferStep


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


class MerchantMigrationRecordSummaryEntity(PrecheckEntitySummary):
    """The pre-check's per-entity counts, plus where the ledger has got to."""

    imported: int = Field(description="How many are already in Polar.")
    selectable: int = Field(
        description="How many an import would actually move: importable by the "
        "pre-check and still pending in the ledger."
    )


class MerchantMigrationRecordSummary(Schema):
    """Every count the review UI needs, from one classification pass."""

    entities: list[MerchantMigrationRecordSummaryEntity] = Field(
        description="Per-entity counts, for the listable entities only."
    )
    action_required: int = Field(
        description=(
            "How many records the pre-check flagged for the merchant to fix, "
            "across entities. Classification only, so a flagged record that has "
            "since been imported still counts."
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


class PanTransferStepComplete(Schema):
    inputs: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Values the step collects. Which keys it accepts depends on the step; "
            "unknown keys are rejected."
        ),
    )


class PanTransferCardCoverage(Schema):
    """How far the moved cards got, once Polar has looked for them.

    "Payment method", not "card": a copied ACH or SEPA mandate is just as
    chargeable, so counting one as uncovered would send the merchant chasing a
    customer who needs nothing.
    """

    covered: int = Field(
        description="Imported subscriptions with a payment method on Polar."
    )
    total: int = Field(description="Imported subscriptions in this migration.")


class PanTransferChecklist(Schema):
    method: PanTransferMethod = Field(
        description=(
            "How the cards move: `pan_copy` for a Stripe source (account to "
            "account), `pan_import` for any other vault."
        )
    )
    started: bool = Field(
        description="Whether the card transfer has been started. Steps are empty until it is."
    )
    current_step_key: str | None = Field(
        description="The one step that can be acted on now. Null once every step is done."
    )
    destination_account_id: str | None = Field(
        description=(
            "The Stripe account the cards move into. The merchant needs it to "
            "address the copy or import to Polar."
        )
    )
    card_coverage: PanTransferCardCoverage | None = Field(
        description=(
            "What the card check found, once it has run. Null before then. The "
            "shortfall is what the `resolve_uncovered` step asks the merchant to "
            "chase."
        )
    )
    steps: Sequence[PanTransferStep] = Field(
        description="The ordered checklist. Titles and guidance live in the client, keyed by `key`."
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
