"""Rendering for the migrations backoffice: badges, progress readouts and the
card-transfer checklist."""

from collections.abc import Sequence

from fastapi import Request
from tagflow import tag, text

from polar.merchant_migration.pan_transfer import (
    PanStepStatus,
    PanTransferStep,
)
from polar.models import MerchantMigration, MerchantMigrationRecord
from polar.models.merchant_migration import MerchantMigrationSourcePlatform

from .. import formatters
from ..components import button
from .mrr import Money, MrrBreakdown
from .status import (
    OWNER_LABELS,
    PAN_STEP_GUIDANCE,
    PAN_STEP_LABELS,
    RECORD_TYPE_LABELS,
    STEP_LABELS,
    Attention,
    AttentionLevel,
    RecordProgress,
    is_ops_actionable,
    step_position,
)

SOURCE_PLATFORM_LABELS: dict[MerchantMigrationSourcePlatform, str] = {
    MerchantMigrationSourcePlatform.stripe: "Stripe",
    MerchantMigrationSourcePlatform.lemon_squeezy: "Lemon Squeezy",
    MerchantMigrationSourcePlatform.paddle: "Paddle",
}

# Colour is reserved for the two levels that mean "an operator has to do
# something". Everything else is a neutral badge, so a full queue still reads as
# a queue and not a warning.
_NEUTRAL_BADGE = "badge-ghost border border-base-300"
_ATTENTION_BADGES: dict[AttentionLevel, str] = {
    AttentionLevel.ops_action: "badge-error",
    AttentionLevel.ops_followup: "badge-warning",
    AttentionLevel.waiting_third_party: _NEUTRAL_BADGE,
    AttentionLevel.waiting_merchant: _NEUTRAL_BADGE,
    AttentionLevel.waiting_polar_app: _NEUTRAL_BADGE,
    AttentionLevel.done: _NEUTRAL_BADGE,
}

_STEP_ICONS: dict[PanStepStatus, tuple[str, str]] = {
    PanStepStatus.completed: ("icon-check", "text-success"),
    PanStepStatus.in_progress: ("icon-circle-dot", "text-warning"),
    PanStepStatus.pending: ("icon-circle-dot", "text-base-content/60"),
    PanStepStatus.blocked: ("icon-circle", "text-base-content/30"),
}


def attention_badge(attention: Attention) -> None:
    # Badges don't wrap: a label that doesn't fit spills out of its pill, so the
    # cell is allowed to widen the column instead.
    with tag.div(classes="flex items-center gap-2"):
        with tag.div(
            classes=(
                f"badge badge-sm whitespace-nowrap {_ATTENTION_BADGES[attention.level]}"
            )
        ):
            text(attention.label)
        if attention.stale_days is not None:
            with tag.div(
                classes="badge badge-sm badge-outline whitespace-nowrap text-warning",
                title="No movement on the current step",
            ):
                text(f"{attention.stale_days}d overdue")


def source_cell(migration: MerchantMigration) -> None:
    with tag.div(classes="flex items-center gap-2"):
        text(SOURCE_PLATFORM_LABELS[migration.source_platform])
        if not migration.source_connected:
            with tag.div(classes="badge badge-sm badge-warning whitespace-nowrap"):
                text("Not connected")
        elif not migration.source_credentials.get("livemode"):
            with tag.div(classes="badge badge-sm badge-outline whitespace-nowrap"):
                text("Test mode")


def step_cell(migration: MerchantMigration) -> None:
    position, total = step_position(migration.step)
    with tag.div(classes="flex flex-col"):
        text(STEP_LABELS[migration.step])
        with tag.div(classes="text-xs text-base-content/60"):
            text(f"Step {position} of {total}")


def money(amount: Money) -> str:
    """A monthly figure per currency, biggest first. Empty reads as a dash."""
    if amount.is_zero:
        return "—"
    return " · ".join(
        formatters.currency(value, currency) for currency, value in amount.by_size()
    )


def mrr_cell(breakdown: MrrBreakdown) -> None:
    total = breakdown.total
    if total.is_zero:
        with tag.span(classes="text-base-content/40"):
            text("No recurring revenue staged")
        return

    with tag.div(classes="flex flex-col gap-1"):
        with tag.div(classes="whitespace-nowrap"):
            text(f"{money(total)} /mo")
        with tag.div(classes="text-xs text-base-content/60"):
            parts = [f"{breakdown.migrated_percent}% on Polar"]
            if not breakdown.to_move.is_zero:
                parts.append(f"{money(breakdown.to_move)} to move")
            if not breakdown.staying.is_zero:
                parts.append(f"{money(breakdown.staying)} staying")
            text(" · ".join(parts))


def mrr_table(breakdown: MrrBreakdown) -> None:
    """Where the revenue sits.

    MRR only: the record tallies cover customers and products too, and putting
    them alongside would read as "these records earn this much".
    """
    rows = (
        ("On Polar", breakdown.on_polar),
        ("To move", breakdown.to_move),
        ("Not migrating", breakdown.staying),
    )
    with tag.div(
        classes="overflow-x-auto rounded-box bg-base-100 border-1 border-base-200"
    ):
        with tag.table(classes="table table-auto"):
            with tag.thead():
                with tag.tr():
                    for header in ("", "MRR"):
                        with tag.th():
                            text(header)
            with tag.tbody():
                for label, amount in rows:
                    with tag.tr():
                        with tag.td():
                            text(label)
                        with tag.td(classes="font-mono whitespace-nowrap"):
                            text(money(amount))
                with tag.tr(classes="font-medium"):
                    with tag.td():
                        text("Total")
                    with tag.td(classes="font-mono whitespace-nowrap"):
                        text(money(breakdown.total))


def records_table(records: RecordProgress) -> None:
    """The ledger tally across every entity: customers, products, subscriptions."""
    rows = (
        ("Imported", records.imported),
        ("Pending", records.pending),
        ("Skipped", records.skipped),
        ("Failed", records.failed),
    )
    with tag.div(classes="flex flex-wrap gap-x-6 gap-y-1 text-sm"):
        for label, count in rows:
            failed = label == "Failed" and count > 0
            with tag.div(classes="flex gap-2"):
                with tag.span(classes="text-base-content/60"):
                    text(label)
                with tag.span(
                    classes="font-mono text-error" if failed else "font-mono"
                ):
                    text(str(count))


def failed_records_table(
    records: Sequence[MerchantMigrationRecord], total: int
) -> None:
    if total > len(records):
        with tag.div(classes="text-sm text-base-content/60"):
            text(f"Showing the first {len(records)} of {total} failures.")
    with tag.div(
        classes="overflow-x-auto rounded-box bg-base-100 border-1 border-base-200"
    ):
        with tag.table(classes="table table-auto"):
            with tag.thead():
                with tag.tr():
                    for header in ("Entity", "Source ID", "Error"):
                        with tag.th():
                            text(header)
            with tag.tbody():
                for record in records:
                    with tag.tr():
                        with tag.td():
                            text(RECORD_TYPE_LABELS[record.type])
                        with tag.td(classes="font-mono text-xs"):
                            text(record.source_id)
                        with tag.td(classes="text-error text-sm"):
                            text(record.error or "—")


def _step_meta(step: PanTransferStep) -> None:
    with tag.div(classes="flex flex-wrap gap-x-4 text-xs text-base-content/60"):
        if step.expected_at is not None:
            with tag.span():
                text(f"Expected by {formatters.datetime(step.expected_at)}")
        if step.completed_at is not None:
            completed_by = (
                step.completed_by.value if step.completed_by is not None else "unknown"
            )
            with tag.span():
                text(
                    f"Completed {formatters.datetime(step.completed_at)} "
                    f"by {completed_by}"
                )
        elif step.started_at is not None:
            with tag.span():
                text(f"Started {formatters.datetime(step.started_at)}")
        for name, value in step.inputs.items():
            with tag.span(classes="font-mono"):
                text(f"{name}: {value}")


def _step_actions(
    request: Request, migration: MerchantMigration, step: PanTransferStep
) -> None:
    with tag.div(classes="flex flex-wrap gap-2 pt-1"):
        if is_ops_actionable(step):
            with button(
                type="button",
                variant="primary",
                size="sm",
                hx_get=str(
                    request.url_for(
                        "merchant_migrations:complete_step",
                        id=migration.id,
                        key=step.key,
                    )
                ),
                hx_target="#modal",
            ):
                text("Complete step")
        with button(
            type="button",
            size="sm",
            outline=True,
            hx_get=str(
                request.url_for(
                    "merchant_migrations:annotate_step",
                    id=migration.id,
                    key=step.key,
                )
            ),
            hx_target="#modal",
        ):
            text("Note & ETA")


def pan_step(
    request: Request,
    migration: MerchantMigration,
    step: PanTransferStep,
    *,
    is_current: bool,
) -> None:
    icon, icon_color = _STEP_ICONS[step.status]
    row_classes = "flex gap-3 p-4"
    if is_current:
        row_classes += " bg-base-200/50"

    with tag.div(classes=row_classes):
        with tag.div(classes=f"{icon} {icon_color} mt-1"):
            pass
        with tag.div(classes="flex flex-col gap-1 grow"):
            with tag.div(classes="flex items-center gap-2 flex-wrap"):
                with tag.span(classes="font-medium"):
                    text(PAN_STEP_LABELS.get(step.key, step.key))
                with tag.div(classes="badge badge-sm badge-outline whitespace-nowrap"):
                    text(OWNER_LABELS[step.owner])
                if step.status == PanStepStatus.in_progress:
                    with tag.div(
                        classes="badge badge-sm badge-warning whitespace-nowrap"
                    ):
                        text("In progress")

            guidance = PAN_STEP_GUIDANCE.get(step.key)
            if is_current and guidance:
                with tag.div(classes="text-sm text-base-content/70"):
                    text(guidance)
            if step.note:
                with tag.div(classes="text-sm"):
                    with tag.span(classes="text-base-content/60"):
                        text("Merchant sees: ")
                    text(step.note)
            _step_meta(step)
            if is_current:
                _step_actions(request, migration, step)


def pan_checklist(
    request: Request, migration: MerchantMigration, current: PanTransferStep | None
) -> None:
    with tag.div(classes="rounded-box bg-base-100 border-1 border-base-200 divide-y"):
        for step in migration.pan_transfer_steps:
            pan_step(
                request,
                migration,
                step,
                is_current=current is not None and step.key == current.key,
            )
