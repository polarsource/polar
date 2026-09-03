from collections.abc import Generator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, time
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Query, Request
from pydantic import UUID4, ValidationError
from tagflow import tag, text

from polar.backoffice.routing import BackofficeRouter
from polar.config import settings
from polar.kit.pagination import PaginationParamsQuery
from polar.merchant_migration.pan_transfer import (
    PanStepOwner,
    PanStepStatus,
    PanTransferStep,
)
from polar.merchant_migration.repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from polar.merchant_migration.service import (
    merchant_migration as merchant_migration_service,
)
from polar.models import MerchantMigration
from polar.models.merchant_migration import MerchantMigrationStep
from polar.models.merchant_migration_record import MerchantMigrationRecordStatus
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)

from .. import formatters
from ..components import (
    alert,
    button,
    datatable,
    description_list,
    metric_card,
    modal,
)
from ..components._tab_nav import Tab, tab_nav
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from . import mrr, views
from .forms import AnnotatePanStepForm
from .mrr import MrrBreakdown
from .status import (
    INPUT_LABELS,
    METHOD_LABELS,
    OWNER_LABELS,
    PAN_STEP_LABELS,
    STEP_LABELS,
    Attention,
    attention,
    current_pan_step,
    progress,
    step_inputs,
    step_position,
)

router = BackofficeRouter()

# A failed record needs reading, not scrolling: past this many, one page of
# examples already tells us what broke.
FAILED_RECORDS_LIMIT = 50


class View(StrEnum):
    needs_ops = "needs_ops"
    active = "active"
    completed = "completed"
    all = "all"


@dataclass(frozen=True)
class Row:
    migration: MerchantMigration
    attention: Attention

    def matches(self, view: View) -> bool:
        match view:
            case View.needs_ops:
                return self.attention.needs_ops
            case View.active:
                return self.migration.step != MerchantMigrationStep.completed
            case View.completed:
                return self.migration.step == MerchantMigrationStep.completed
            case View.all:
                return True


async def _load_rows(session: AsyncReadSession) -> list[Row]:
    """Every migration with its triage badge.

    Attention is derived from the checklist JSONB and a ledger tally, so it can't
    be a SQL filter — the whole set is read and classified in one pass. Only the
    failed count is read here; MRR is left to the page being rendered, since it
    scales with the number of migrated subscriptions.
    """
    repository = MerchantMigrationRepository.from_session(session)
    migrations = await repository.get_all(repository.get_ops_statement())
    failed = await MerchantMigrationRecordRepository.from_session(session).count_failed(
        [migration.id for migration in migrations]
    )
    return [
        Row(migration, attention(migration, failed.get(migration.id, 0)))
        for migration in migrations
    ]


async def _page_mrr(
    session: AsyncReadSession, rows: Sequence[Row]
) -> dict[UUID, MrrBreakdown]:
    """MRR for the rendered rows only.

    Products are read for the whole organization so a subscription priced by an
    earlier run still resolves; subscriptions, the volume side, are read only for
    the migrations on screen.
    """
    repository = MerchantMigrationRecordRepository.from_session(session)
    migration_ids = [row.migration.id for row in rows]
    return mrr.breakdown(
        await repository.list_product_canonicals(
            [row.migration.organization_id for row in rows]
        ),
        await repository.list_subscription_canonicals(migration_ids),
        migration_ids,
    )


def _view_tabs(request: Request, rows: Sequence[Row], view: View) -> list[Tab]:
    labels = {
        View.needs_ops: "Needs ops",
        View.active: "Active",
        View.completed: "Completed",
        View.all: "All",
    }
    base = str(request.url_for("merchant_migrations:list"))
    tabs: list[Tab] = []
    for candidate in View:
        count = sum(1 for row in rows if row.matches(candidate))
        tabs.append(
            Tab(
                labels[candidate],
                url=f"{base}?view={candidate.value}",
                active=view == candidate,
                count=count,
                badge_variant="error"
                if candidate is View.needs_ops and count
                else None,
            )
        )
    return tabs


def _render_table(
    request: Request, rows: Sequence[Row], mrr_by_migration: dict[UUID, MrrBreakdown]
) -> None:
    with tag.div(
        classes="overflow-x-auto rounded-box bg-base-100 border-1 border-base-200"
    ):
        with tag.table(classes="table table-auto"):
            with tag.thead():
                with tag.tr():
                    for header in (
                        "Organization",
                        "Source",
                        "Progress",
                        "MRR",
                        "Attention",
                        "Waiting on",
                        "Updated",
                    ):
                        with tag.th():
                            text(header)
            with tag.tbody():
                if not rows:
                    with tag.tr():
                        with tag.td(
                            classes="text-center text-base-content/50 py-12", colspan=7
                        ):
                            text("No migrations in this view.")
                for row in rows:
                    migration = row.migration
                    detail_url = str(
                        request.url_for("merchant_migrations:detail", id=migration.id)
                    )
                    with tag.tr(
                        classes="hover cursor-pointer",
                        _=f"on click set window.location to '{detail_url}'",
                    ):
                        with tag.td():
                            with tag.a(href=detail_url, classes="no-underline"):
                                text(migration.organization.name)
                        with tag.td():
                            views.source_cell(migration)
                        with tag.td():
                            views.step_cell(migration)
                        with tag.td():
                            views.mrr_cell(mrr_by_migration[migration.id])
                        with tag.td():
                            views.attention_badge(row.attention)
                        with tag.td(classes="text-sm text-base-content/60"):
                            text(row.attention.detail)
                        with tag.td(classes="text-sm text-base-content/60"):
                            text(
                                formatters.datetime(
                                    migration.modified_at or migration.created_at
                                )
                            )


@router.get("/", name="merchant_migrations:list")
async def list_migrations(
    request: Request,
    pagination: PaginationParamsQuery,
    view: Annotated[View, Query()] = View.active,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> None:
    rows = await _load_rows(session)
    matching = [row for row in rows if row.matches(view)]
    start = (pagination.page - 1) * pagination.limit
    page = matching[start : start + pagination.limit]
    mrr_by_migration = await _page_mrr(session, page)

    with layout(
        request,
        [("Migrations", str(request.url_for("merchant_migrations:list")))],
        "merchant_migrations:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Migrations")
            with tab_nav(_view_tabs(request, rows, view)):
                pass
            _render_table(request, page, mrr_by_migration)
            with datatable.pagination(request, pagination, len(matching)):
                pass


async def _get_migration(
    session: AsyncReadSession, id: UUID4, *, for_update: bool = False
) -> MerchantMigration:
    repository = MerchantMigrationRepository.from_session(session)
    migration = await repository.get_ops_by_id(id, for_update=for_update)
    if migration is None:
        raise HTTPException(status_code=404, detail="Migration not found")
    return migration


def _get_step(migration: MerchantMigration, key: str) -> PanTransferStep:
    for step in migration.pan_transfer_steps:
        if step.key == key:
            return step
    raise HTTPException(status_code=404, detail="Card transfer step not found")


def _detail_redirect(request: Request, id: UUID4) -> HXRedirectResponse:
    """Send the browser back to the detail page.

    Via the `HX-Redirect` header: htmx has no `hx-redirect` attribute, so
    rendering one leaves the operator looking at the pre-action page.
    """
    return HXRedirectResponse(
        request, str(request.url_for("merchant_migrations:detail", id=id)), 303
    )


class SourcePlatformItem(description_list.DescriptionListItem[MerchantMigration]):
    def render(
        self, request: Request, item: MerchantMigration
    ) -> Generator[None] | None:
        text(views.SOURCE_PLATFORM_LABELS[item.source_platform])
        return None


class SourceAccountItem(description_list.DescriptionListItem[MerchantMigration]):
    def render(
        self, request: Request, item: MerchantMigration
    ) -> Generator[None] | None:
        text(item.source_credentials.get("stripe_user_id") or "—")
        return None


class SourceModeItem(description_list.DescriptionListItem[MerchantMigration]):
    def render(
        self, request: Request, item: MerchantMigration
    ) -> Generator[None] | None:
        if not item.source_connected:
            text("Not connected")
            return None
        text("Live" if item.source_credentials.get("livemode") else "Test")
        return None


SOURCE_DESCRIPTION_LIST = description_list.DescriptionList[MerchantMigration](
    description_list.DescriptionListAttrItem("id", "Migration ID", clipboard=True),
    description_list.DescriptionListAttrItem("organization.slug", "Organization slug"),
    SourcePlatformItem("Source platform"),
    SourceAccountItem("Source account"),
    SourceModeItem("Mode"),
    description_list.DescriptionListDateTimeItem("created_at", "Created"),
    description_list.DescriptionListDateTimeItem("modified_at", "Updated"),
)


@router.get("/{id}", name="merchant_migrations:detail")
async def get_migration(
    request: Request,
    id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> None:
    migration = await _get_migration(session, id)
    record_repository = MerchantMigrationRecordRepository.from_session(session)
    counts = await record_repository.count_by_type_and_status([migration.id])
    records = progress(counts, migration.id)
    breakdown = mrr.breakdown(
        await record_repository.list_product_canonicals([migration.organization_id]),
        await record_repository.list_subscription_canonicals([migration.id]),
        [migration.id],
    )[migration.id]
    triage = attention(migration, records.failed)
    current = current_pan_step(migration)
    failed = (
        await record_repository.list_by_migration_and_status(
            migration.id,
            MerchantMigrationRecordStatus.failed,
            limit=FAILED_RECORDS_LIMIT,
        )
        if records.failed
        else []
    )

    position, total = step_position(migration.step)

    with layout(
        request,
        [
            (
                migration.organization.name,
                str(request.url_for("merchant_migrations:detail", id=migration.id)),
            ),
            ("Migrations", str(request.url_for("merchant_migrations:list"))),
        ],
        "merchant_migrations:list",
    ):
        with tag.div(classes="flex flex-col gap-6"):
            with tag.div(classes="flex items-center gap-4"):
                with tag.h1(classes="text-3xl"):
                    with tag.a(
                        href=str(
                            request.url_for(
                                "organizations:detail",
                                organization_id=migration.organization_id,
                            )
                        ),
                        classes="no-underline",
                    ):
                        text(migration.organization.name)
                views.attention_badge(triage)

            with alert("warning" if triage.needs_ops else None, soft=True):
                with tag.div(classes="flex flex-col gap-1"):
                    with tag.span(classes="font-medium"):
                        text(triage.headline)
                    with tag.span(classes="text-sm"):
                        text(triage.detail)

            with tag.div(classes="grid grid-cols-2 lg:grid-cols-4 gap-4"):
                with metric_card(
                    "Step", f"{position}/{total}", subtitle=STEP_LABELS[migration.step]
                ):
                    pass
                with metric_card(
                    "MRR at stake",
                    views.money(breakdown.total),
                    subtitle="per month",
                ):
                    pass
                with metric_card(
                    "On Polar",
                    views.money(breakdown.on_polar),
                    subtitle=f"{breakdown.migrated_percent}% of the migration",
                ):
                    pass
                with metric_card(
                    "Still to move",
                    views.money(breakdown.to_move),
                    subtitle=f"{records.pending} record(s) pending",
                ):
                    pass

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-6"):
                with tag.div(classes="flex flex-col gap-2"):
                    with tag.h2(classes="text-xl"):
                        text("Source")
                    with SOURCE_DESCRIPTION_LIST.render(request, migration):
                        pass
                with tag.div(classes="flex flex-col gap-4"):
                    with tag.h2(classes="text-xl"):
                        text("Recurring revenue")
                    views.mrr_table(breakdown)
                    with tag.h2(classes="text-xl"):
                        text("Records")
                    views.records_table(records)

            with tag.div(classes="flex flex-col gap-2"):
                with tag.h2(classes="text-xl"):
                    text("Card transfer")
                if not migration.pan_transfer_steps:
                    with alert(soft=True):
                        text(
                            "The merchant hasn't started the card transfer yet. "
                            "It unlocks once the catalog is imported."
                        )
                else:
                    destination = (
                        settings.MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID
                    )
                    with tag.div(classes="text-sm text-base-content/60"):
                        text(
                            f"{METHOD_LABELS[migration.pan_transfer_method]} · "
                            + (
                                f"cards land on {destination}"
                                if destination
                                else "no destination account configured"
                            )
                        )
                    views.pan_checklist(request, migration, current)

            if failed:
                with tag.div(classes="flex flex-col gap-2"):
                    with tag.h2(classes="text-xl"):
                        text("Failed records")
                    views.failed_records_table(failed, records.failed)


@router.api_route(
    "/{id}/steps/{key}/complete",
    name="merchant_migrations:complete_step",
    methods=["GET", "POST"],
    response_model=None,
)
async def complete_step(
    request: Request,
    id: UUID4,
    key: str,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    migration = await _get_migration(session, id, for_update=request.method == "POST")
    step = _get_step(migration, key)
    inputs = step_inputs(migration, key)

    if request.method == "POST":
        form_data = await request.form()
        await merchant_migration_service.complete_pan_step_as_ops(
            session,
            migration,
            key,
            inputs={name: str(form_data.get(name, "")) for name, _ in inputs},
        )
        await add_toast(
            request,
            f"Completed “{PAN_STEP_LABELS.get(key, key)}”",
            variant="success",
        )
        return _detail_redirect(request, id)

    label = PAN_STEP_LABELS.get(key, key)
    with modal(f"Complete: {label}", open=True):
        with tag.form(
            hx_post=str(
                request.url_for(
                    "merchant_migrations:complete_step", id=migration.id, key=key
                )
            ),
            hx_target="#modal",
            classes="flex flex-col gap-4",
        ):
            with tag.p(classes="text-sm"):
                text(
                    f"This marks the step done and unblocks the next one. "
                    f"It is owned by {OWNER_LABELS[step.owner]}."
                )
            if step.owner == PanStepOwner.merchant:
                with alert("warning", soft=True):
                    text(
                        "You are completing this on the merchant's behalf. Only do "
                        "it once you know they have actually done it."
                    )
            for name, required in inputs:
                with tag.fieldset(classes="fieldset"):
                    with tag.label(classes="label", **{"for": name}):
                        text(INPUT_LABELS.get(name, name))
                    with tag.input(
                        id=name,
                        name=name,
                        type="text",
                        classes="input w-full",
                        required=required,
                        value=step.inputs.get(name, ""),
                    ):
                        pass
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(type="submit", variant="primary"):
                    text("Complete step")
    return None


@router.api_route(
    "/{id}/steps/{key}/annotate",
    name="merchant_migrations:annotate_step",
    methods=["GET", "POST"],
    response_model=None,
)
async def annotate_step(
    request: Request,
    id: UUID4,
    key: str,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    migration = await _get_migration(session, id, for_update=request.method == "POST")
    step = _get_step(migration, key)

    validation_error: ValidationError | None = None
    if request.method == "POST":
        form_data = await request.form()
        try:
            form = AnnotatePanStepForm.model_validate_form(form_data)
        except ValidationError as e:
            validation_error = e
        else:
            await merchant_migration_service.annotate_pan_step(
                session,
                migration,
                key,
                # Always a string, never None: the form is prefilled with the
                # current note, so an empty box means the operator cleared it.
                note=form.note or "",
                # Stored on a tz-aware column and compared against now, so the
                # date the operator picked is anchored to midnight UTC.
                expected_at=(
                    datetime.combine(form.expected_at, time.min, tzinfo=UTC)
                    if form.expected_at is not None
                    else None
                ),
                # The form is prefilled, so an empty date means "drop the ETA".
                clear_expected_at=form.expected_at is None,
                # Re-ticking the box on a step already in progress is a no-op, not
                # an error: the operator asked for a state it is already in.
                in_progress=(form.in_progress and step.status == PanStepStatus.pending),
            )
            await add_toast(request, "Step updated", variant="success")
            return _detail_redirect(request, id)

    with modal(f"Note & ETA: {PAN_STEP_LABELS.get(key, key)}", open=True):
        with AnnotatePanStepForm.render(
            data={
                "note": step.note,
                "expected_at": (
                    step.expected_at.date() if step.expected_at is not None else None
                ),
                "in_progress": step.status == PanStepStatus.in_progress,
            },
            validation_error=validation_error,
            hx_post=str(
                request.url_for(
                    "merchant_migrations:annotate_step", id=migration.id, key=key
                )
            ),
            hx_target="#modal",
            classes="flex flex-col gap-4",
        ):
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(type="submit", variant="primary"):
                    text("Save")
    return None
