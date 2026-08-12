"""What an operator needs to read off a migration at a glance.

Two questions, both answered here: how far has this migration got, and is anyone
at Polar holding it up. The merchant-facing app answers neither — it only ever
shows one merchant their own checklist — so the wording and the triage rules are
this module's own.
"""

from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum
from uuid import UUID

from polar.kit.utils import utc_now
from polar.merchant_migration.pan_transfer import (
    PanStepOwner,
    PanTransferMethod,
    PanTransferStep,
    current,
    templates_for,
)
from polar.merchant_migration.repository import RecordCounts
from polar.models import MerchantMigration
from polar.models.merchant_migration import MerchantMigrationStep
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)

# A step nobody has moved for this long has stopped being progress and started
# being something to chase.
STALE_AFTER = timedelta(days=7)

STEP_LABELS: dict[MerchantMigrationStep, str] = {
    MerchantMigrationStep.source_setup: "Source connected",
    MerchantMigrationStep.pre_check: "Pre-check run",
    MerchantMigrationStep.create_catalog: "Catalog imported",
    MerchantMigrationStep.copy_cards: "Moving cards",
    MerchantMigrationStep.activate_subscriptions: "Activating subscriptions",
    MerchantMigrationStep.cleanup: "Cleanup",
    MerchantMigrationStep.completed: "Completed",
}

STEP_ORDER = list(MerchantMigrationStep)

METHOD_LABELS: dict[PanTransferMethod, str] = {
    PanTransferMethod.pan_copy: "Stripe to Stripe copy",
    PanTransferMethod.pan_import: "Vault import via Stripe",
}

OWNER_LABELS: dict[PanStepOwner, str] = {
    PanStepOwner.merchant: "Merchant",
    PanStepOwner.polar_ops: "Polar Ops",
    PanStepOwner.polar_app: "Polar app",
    PanStepOwner.stripe: "Stripe",
    PanStepOwner.provider: "Source provider",
}

# Ops wording for the card checklist. The merchant reads a different set (see
# `panTransferCopy.ts`): here a step says who we are waiting on and what the
# operator does about it.
PAN_STEP_LABELS: dict[str, str] = {
    "share_destination_account": "Share Polar's Stripe account",
    "start_copy": "Merchant starts the copy in Stripe",
    "authorize_copy": "Accept the incoming copy",
    "stripe_copy": "Stripe copies the cards",
    "open_stripe_request": "Open the migration request with Stripe",
    "request_provider_export": "Merchant asks their provider for the export",
    "provider_export": "Provider prepares the export",
    "map_customers": "Polar maps the customers",
    "stripe_review": "Stripe reviews the file",
    "approve_import": "Approve the import",
    "stripe_import": "Stripe imports the cards",
    "verify_cards": "Polar verifies the cards",
    "resolve_uncovered": "Merchant handles customers without a card",
    "cutover": "Merchant cuts over billing",
    "move_subscriptions": "Polar activates the subscriptions",
}

PAN_STEP_GUIDANCE: dict[str, str] = {
    "authorize_copy": (
        "Accept the copy request on Polar's Stripe account, then complete this "
        "step. Usually one business day after the merchant starts it."
    ),
    "open_stripe_request": (
        "Open a card migration request with Stripe, share Polar's PCI documents, "
        "and record the request ID. The merchant quotes it to their provider."
    ),
    "approve_import": (
        "Read Stripe's summary of the provider's file and approve it. Anything "
        "wrong in the file has to go back to the provider before this."
    ),
    "stripe_copy": "Stripe takes a few hours, up to 72. Set an ETA if it drags.",
    "stripe_review": "Stripe replies with a summary. Chase it if it goes quiet.",
    "stripe_import": "Around ten business days once Stripe has correct data.",
    "provider_export": "Around two weeks. The provider sends the file to Stripe.",
}

INPUT_LABELS: dict[str, str] = {
    "stripe_migration_request_id": "Stripe request ID",
    "provider_reference": "Provider ticket reference",
    "provider_contact": "Provider contact",
}

RECORD_TYPE_LABELS: dict[MerchantMigrationRecordType, str] = {
    MerchantMigrationRecordType.customer: "Customers",
    MerchantMigrationRecordType.product: "Products",
    MerchantMigrationRecordType.subscription: "Subscriptions",
    MerchantMigrationRecordType.order: "Orders",
    MerchantMigrationRecordType.discount: "Discounts",
}


class AttentionLevel(StrEnum):
    """Why an operator would open this migration, worst first."""

    ops_action = "ops_action"
    ops_followup = "ops_followup"
    waiting_third_party = "waiting_third_party"
    waiting_merchant = "waiting_merchant"
    waiting_polar_app = "waiting_polar_app"
    done = "done"


# Ops sorts and filters on this: everything above `waiting_merchant` is on us.
OPS_LEVELS = frozenset({AttentionLevel.ops_action, AttentionLevel.ops_followup})


@dataclass(frozen=True)
class Attention:
    level: AttentionLevel
    label: str
    detail: str
    # How long the migration has sat where it is, once that stops being normal.
    stale_days: int | None

    @property
    def headline(self) -> str:
        """One line saying why this migration is (or isn't) in the queue."""
        if self.level in OPS_LEVELS:
            return "Ops action needed"
        if self.stale_days is not None:
            return "Overdue — worth chasing"
        return "Nothing to do here"

    @property
    def needs_ops(self) -> bool:
        """Whether this migration belongs in the operator's queue.

        An overdue step counts even when nobody at Polar owns it: something we
        were promised hasn't landed, and chasing it is ours.
        """
        return self.level in OPS_LEVELS or self.stale_days is not None


@dataclass(frozen=True)
class RecordProgress:
    total: int
    imported: int
    pending: int
    skipped: int
    failed: int


def progress(counts: RecordCounts, migration_id: UUID) -> RecordProgress:
    """Fold the per-(type, status) tally into one per-status view of a migration."""

    def total(status: MerchantMigrationRecordStatus) -> int:
        return sum(
            counts.get((migration_id, type, status), 0)
            for type in MerchantMigrationRecordType
        )

    imported = total(MerchantMigrationRecordStatus.imported)
    pending = total(MerchantMigrationRecordStatus.pending)
    skipped = total(MerchantMigrationRecordStatus.skipped)
    failed = total(MerchantMigrationRecordStatus.failed)
    return RecordProgress(
        total=imported + pending + skipped + failed,
        imported=imported,
        pending=pending,
        skipped=skipped,
        failed=failed,
    )


def step_position(step: MerchantMigrationStep) -> tuple[int, int]:
    """1-based position of the migration's step, for a `3 of 7` readout."""
    return STEP_ORDER.index(step) + 1, len(STEP_ORDER)


def current_pan_step(migration: MerchantMigration) -> PanTransferStep | None:
    """The one card step that can be acted on, or None if the checklist hasn't
    started or is finished."""
    return current(migration.pan_transfer_steps)


def _stale_days(step: PanTransferStep) -> int | None:
    """How many days late a step is, or None while it is still on track.

    Two independent rules, worst one wins: it is past the date Ops promised, or
    nobody has moved it in a week. An ETA is picked as a calendar date, so the
    step only counts as late once that whole day has gone by.
    """
    now = utc_now()
    late: list[int] = []
    if step.expected_at is not None:
        days = (now.date() - step.expected_at.date()).days
        if days > 0:
            late.append(days)
    if step.started_at is not None:
        waiting = now - step.started_at
        if waiting > STALE_AFTER:
            late.append(waiting.days)
    return max(late) if late else None


def _pan_attention(step: PanTransferStep) -> Attention:
    label = PAN_STEP_LABELS.get(step.key, step.key)
    stale_days = _stale_days(step)

    match step.owner:
        case PanStepOwner.polar_ops:
            return Attention(
                AttentionLevel.ops_action,
                "Ops action",
                label,
                stale_days,
            )
        case PanStepOwner.stripe | PanStepOwner.provider:
            # We can't move these, but an unexplained wait is still ours: without
            # a note or an ETA the merchant is staring at a dead badge.
            if step.note is None and step.expected_at is None:
                return Attention(
                    AttentionLevel.ops_followup,
                    "No ETA",
                    f"Waiting on {OWNER_LABELS[step.owner]}: {label}",
                    stale_days,
                )
            return Attention(
                AttentionLevel.waiting_third_party,
                f"With {OWNER_LABELS[step.owner]}",
                label,
                stale_days,
            )
        case PanStepOwner.polar_app:
            return Attention(
                AttentionLevel.waiting_polar_app,
                "Polar job",
                label,
                stale_days,
            )
        case _:
            return Attention(
                AttentionLevel.waiting_merchant,
                "With merchant",
                label,
                stale_days,
            )


def attention(migration: MerchantMigration, failed_records: int) -> Attention:
    """Triage one migration into a single badge.

    Failed ledger rows win over everything else: the import gave up on them, and
    nothing in the checklist will pick them back up on its own.
    """
    step = current_pan_step(migration)
    if failed_records:
        return Attention(
            AttentionLevel.ops_action,
            "Ops action",
            f"{failed_records} record(s) failed to import",
            # A migration can be both failing and stuck; keep the overdue signal.
            _stale_days(step) if step is not None else None,
        )

    if migration.step == MerchantMigrationStep.completed:
        return Attention(AttentionLevel.done, "Done", "Migration completed", None)

    if step is not None:
        return _pan_attention(step)
    if migration.pan_transfer_steps:
        # Every card step is done but the migration hasn't been closed out.
        return Attention(
            AttentionLevel.ops_action,
            "Ops action",
            "Card transfer finished — close the migration out",
            None,
        )

    match migration.step:
        case (
            MerchantMigrationStep.source_setup
            | MerchantMigrationStep.pre_check
            | MerchantMigrationStep.create_catalog
        ):
            return Attention(
                AttentionLevel.waiting_merchant,
                "With merchant",
                f"{STEP_LABELS[migration.step]} — merchant drives the next step",
                None,
            )
        case _:
            return Attention(
                AttentionLevel.waiting_polar_app,
                "Polar job",
                STEP_LABELS[migration.step],
                None,
            )


def is_ops_actionable(step: PanTransferStep) -> bool:
    """Whether the backoffice offers to complete this step. Ops never stand in for
    `polar_app`: those steps have side effects that completing would skip."""
    return step.owner != PanStepOwner.polar_app


def step_inputs(migration: MerchantMigration, key: str) -> list[tuple[str, bool]]:
    """The (name, required) inputs the checklist engine accepts on a step, so the
    complete form asks for exactly what the transition will validate."""
    for template in templates_for(migration.pan_transfer_method):
        if template.key == key:
            return [(name, True) for name in template.required_inputs] + [
                (name, False) for name in template.optional_inputs
            ]
    return []
