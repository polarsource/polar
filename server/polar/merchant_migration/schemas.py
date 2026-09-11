from collections.abc import Sequence
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import UUID4, Field

from polar.enums import SubscriptionRecurringInterval
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_operation import MerchantMigrationOperationStatus
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
    MerchantMigrationRecordStatus,
)

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


class ProductMappingIncompatibility(StrEnum):
    not_recurring = "not_recurring"
    interval_mismatch = "interval_mismatch"
    currency_mismatch = "currency_mismatch"
    amount_mismatch = "amount_mismatch"
    missing_fixed_price = "missing_fixed_price"


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
            "The ledger record id. For subscriptions this is what the merchant "
            "selects for import. Null for price rows, which import with their product."
        ),
    )
    entity: PrecheckEntity = Field(description="The source entity type.")
    source_id: str = Field(description="The source identifier (e.g. Stripe `sub_…`).")
    title: str = Field(description="Primary label (name, email or product).")
    subtitle: str | None = Field(
        description="Secondary detail (lifecycle status, country)."
    )
    product_name: str | None = Field(
        description=(
            "The source product name. None for customer rows, and for a "
            "subscription whose product wasn't in the staged catalog."
        ),
    )
    product_source_id: str | None = Field(
        description=(
            "The source product identifier (e.g. Stripe `prod_…`). None for "
            "customer rows, and for a subscription whose product wasn't staged."
        ),
    )
    customer_email: str | None = Field(
        description=(
            "The customer email. None for product and price rows, or when the "
            "source customer has none."
        ),
    )
    customer_name: str | None = Field(
        description=(
            "The customer name on the source. None for product and price rows, or "
            "when the source customer has none."
        ),
    )
    customer_source_id: str | None = Field(
        description=(
            "The source customer identifier (e.g. Stripe `cus_…`). None for "
            "product and price rows."
        ),
    )
    customer_country: str | None = Field(
        description=(
            "The customer billing country. None for product and price rows, or "
            "when the source customer has none."
        ),
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
    recurring_interval_count: int | None = Field(
        description=(
            "How many `recurring_interval` units each billing period spans, so a "
            "quarterly price reads as 3 months. None for rows without an interval."
        ),
    )
    automatic_tax: bool | None = Field(
        description=(
            "Whether the source computed tax on this subscription. None for "
            "non-subscription rows, or when the source doesn't say."
        ),
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
    cutover_status: MerchantMigrationCutoverStatus | None = Field(
        description=(
            "What the switch did with this subscription: `moved` (Polar bills it "
            "now), `skipped` (left on the source, see `cutover_error`) or `failed` "
            "(retryable). Null when the switch hasn't reached it, and for every "
            "entity other than subscriptions."
        ),
    )
    cutover_error: str | None = Field(
        description="Why the switch skipped or failed this subscription.",
    )
    renews_at: datetime | None = Field(
        description=(
            "When the subscription next renews on the source, as staged at import. "
            "Null for non-subscription rows or when the source reported none."
        ),
    )
    has_payment_method: bool | None = Field(
        description=(
            "Whether Polar already has a card to charge for this subscription's "
            "customer. Null for non-subscription rows."
        ),
    )
    dependencies_imported: bool | None = Field(
        description=(
            "Whether this subscription's customer and product are already in Polar, "
            "so it can be created at cutover. Null for non-subscription rows."
        ),
    )


class MerchantMigrationRecordSummaryEntity(PrecheckEntitySummary):
    """The pre-check's per-entity counts, plus where the ledger has got to."""

    imported: int = Field(description="How many are already in Polar.")
    ready: int = Field(
        description="How many subscriptions are prepared and ready to switch."
    )
    action_required: int = Field(
        description="How many require merchant action before they can be prepared."
    )
    selectable: int = Field(
        description="How many subscriptions an import would still prepare: "
        "importable by the pre-check, pending in the ledger, and not already backed "
        "by an imported customer and product. Zero for other entities."
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


class MerchantMigrationProductMappingChoice(Schema):
    source_id: str = Field(
        description=(
            "The staged catalog product id (`prod_…:month:1`). One Polar product "
            "per source interval."
        ),
    )
    polar_product_id: UUID4 | None = Field(
        description=(
            "The Polar product to reuse. None creates a new Polar product for "
            "this source product."
        ),
    )


class MerchantMigrationImportRequest(Schema):
    record_ids: list[UUID4] | None = Field(
        default=None,
        description=(
            "Subscription ledger record ids to prepare (from the records listing). "
            "Their customers and products are imported automatically. When omitted, "
            "every importable subscription is prepared (subject to "
            "`exclude_record_ids`). Polar subscriptions are created at cutover."
        ),
    )
    exclude_record_ids: list[UUID4] | None = Field(
        default=None,
        description=(
            "Prepare every importable subscription except these — the opt-out "
            "selection for large catalogs. Ignored when `record_ids` is set."
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


class MerchantMigrationCutoverRequest(Schema):
    record_ids: list[UUID4] | None = Field(
        default=None,
        description=(
            "Subscription ledger record ids to switch (from the records listing). "
            "When omitted, every subscription whose customer and product are in "
            "Polar is switched (subject to `exclude_record_ids`)."
        ),
    )
    exclude_record_ids: list[UUID4] | None = Field(
        default=None,
        description=(
            "Switch every subscription whose customer and product are in Polar "
            "except these — the opt-out selection for large catalogs. Ignored when "
            "`record_ids` is set."
        ),
    )


class MerchantMigrationCutoverReport(Schema):
    """Where the switch has got to, for the imported subscriptions."""

    started: bool = Field(description="Whether the merchant has confirmed the switch.")
    running: bool = Field(description="Whether a switch run is in progress.")
    completed: bool = Field(description="Whether the last switch run has finished.")
    total: int = Field(
        description="Subscriptions whose customer and product are in Polar."
    )
    pending: int = Field(description="Not switched yet.")
    moved: int = Field(description="Now billed by Polar.")
    skipped: int = Field(description="Left on the source.")
    failed: int = Field(description="Hit an unexpected error.")


class PanTransferStepComplete(Schema):
    inputs: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Values the step collects. Which keys it accepts depends on the step; "
            "unknown keys are rejected."
        ),
    )


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
    steps: Sequence[PanTransferStep] = Field(
        description="The ordered checklist. Titles and guidance live in the client, keyed by `key`."
    )


class MerchantMigrationOperation(Schema):
    """Background work for the current migration step."""

    status: MerchantMigrationOperationStatus = Field(
        description="pending or running while Polar works; done or failed when it finishes."
    )
    stalled: bool = Field(
        description="Whether an active operation has stopped making progress."
    )
    error: str | None = Field(
        description="Why the run failed. None while it is pending, running, or done."
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
    operation: MerchantMigrationOperation | None = Field(
        description=(
            "Background work for the current step, if any. None until a run starts."
        ),
    )


class MerchantMigrationMappedPrice(Schema):
    amount: int = Field(
        description="Price in the currency's smallest unit (cents for USD)."
    )
    currency: str = Field(description="ISO currency code.")


class MerchantMigrationPolarProductOption(Schema):
    id: UUID4 = Field(description="The Polar product id.")
    name: str = Field(description="The Polar product name.")
    recurring_interval: SubscriptionRecurringInterval | None = Field(
        description="Billing interval (`month`, `year`). None for one-time products."
    )
    recurring_interval_count: int | None = Field(
        description="How many `recurring_interval` units each period spans."
    )
    prices: list[MerchantMigrationMappedPrice] = Field(
        description="Active fixed catalog prices."
    )
    compatible: bool = Field(
        description=(
            "Whether currency and billing interval match the Stripe product. "
            "Amount may differ: imported subscribers keep the Stripe price."
        )
    )
    incompatibilities: list[ProductMappingIncompatibility] = Field(
        description=(
            "Differences from the Stripe product. `amount_mismatch` is informational "
            "and does not block mapping; other values make `compatible` false."
        )
    )


class MerchantMigrationProductMappingItem(Schema):
    source_id: str = Field(
        description="The staged catalog product id (`prod_…:month:1`)."
    )
    product_source_id: str = Field(description="The Stripe product id (`prod_…`).")
    name: str = Field(description="The Stripe product name.")
    recurring_interval: str | None = Field(
        description="Billing interval on the source."
    )
    recurring_interval_count: int = Field(
        description="How many `recurring_interval` units each period spans."
    )
    prices: list[MerchantMigrationMappedPrice] = Field(
        description="Importable fixed prices on this source product."
    )
    subscriber_count: int = Field(
        description="How many staged subscriptions bill this product."
    )
    import_status: MerchantMigrationRecordStatus = Field(
        description="Whether this product has already been imported or skipped."
    )
    polar_product_id: UUID4 | None = Field(
        description=(
            "The Polar product chosen for this source product. None when creating "
            "a new Polar product or when no choice has been saved yet."
        )
    )
    create_new: bool = Field(
        description=(
            "The merchant chose to create a new Polar product instead of mapping."
        )
    )
    suggested_product_id: UUID4 | None = Field(
        description=(
            "The unique Polar product to map onto: a unique name among interval-"
            "compatible products, or else a unique amount, currency, and interval "
            "match. None when there is no unique match."
        )
    )
    name_collision: bool = Field(description="A Polar product already uses this name.")
    requires_choice: bool = Field(
        description=(
            "The merchant must map or explicitly create a new product before "
            "import. True when a Polar product shares the name but there is no "
            "unique interval-compatible match, and no mapping has been saved."
        )
    )
    candidates: list[MerchantMigrationPolarProductOption] = Field(
        description=(
            "Active Polar products, including ones whose currency or interval "
            "does not match. Only `compatible` candidates can be mapped onto."
        )
    )


class MerchantMigrationProductMappingList(Schema):
    items: list[MerchantMigrationProductMappingItem] = Field(
        description="Importable source products and how they map onto Polar."
    )


class MerchantMigrationProductMappingUpdate(Schema):
    mappings: list[MerchantMigrationProductMappingChoice] = Field(
        description=(
            "Replaces the saved mappings for the listed source products. None "
            "for `polar_product_id` creates a new Polar product."
        ),
    )
