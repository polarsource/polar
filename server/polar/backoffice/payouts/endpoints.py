import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload
from tagflow import attr, classes, tag, text

from polar.enums import AccountType
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Account, Organization, Payout, PayoutAttempt, Transaction
from polar.models.payout import PayoutStatus
from polar.models.payout_attempt import PayoutAttemptStatus
from polar.payout.repository import PayoutRepository
from polar.payout.service import payout as payout_service
from polar.payout.sorting import ListSorting, PayoutSortProperty
from polar.postgres import AsyncSession, get_db_session
from polar.worker import enqueue_job

from ..components import button, datatable, description_list, input, modal
from ..layout import layout
from ..toast import add_toast

router = APIRouter()


@contextlib.contextmanager
def payout_status_badge(status: PayoutStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        match status:
            case PayoutStatus.succeeded:
                classes("badge-success")
            case PayoutStatus.in_transit:
                classes("badge-warning")
            case PayoutStatus.failed:
                classes("badge-error")
            case PayoutStatus.pending:
                classes("badge-neutral")
            case PayoutStatus.canceled:
                classes("badge-neutral")
        text(status.value.replace("_", " ").title())
    yield


class PayoutStatusColumn(datatable.DatatableAttrColumn[Payout, PayoutSortProperty]):
    def render(self, request: Request, item: Payout) -> Generator[None] | None:
        with payout_status_badge(item.status):
            pass
        return None


class PayoutStatusListItem(description_list.DescriptionListAttrItem[Payout]):
    def render(self, request: Request, item: Payout) -> Generator[None] | None:
        with payout_status_badge(item.status):
            pass
        return None


class PayoutAccountProcessorIdListItem(description_list.DescriptionListItem[Payout]):
    def __init__(self) -> None:
        super().__init__("processor_id")

    def render(self, request: Request, item: Payout) -> Generator[None] | None:
        account = item.account
        if account.stripe_id and account.account_type == AccountType.stripe:
            with tag.a(
                href=f"https://dashboard.stripe.com/connect/accounts/{account.stripe_id}",
                classes="link flex flex-row gap-1 items-center",
            ):
                attr("target", "_blank")
                attr("rel", "noopener noreferrer")
                text(account.stripe_id)
                with tag.div(classes="icon-external-link"):
                    pass
        elif account.stripe_id:
            text(account.stripe_id)
        return None


@contextlib.contextmanager
def payout_attempt_status_badge(status: PayoutAttemptStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        match status:
            case PayoutAttemptStatus.succeeded:
                classes("badge-success")
            case PayoutAttemptStatus.in_transit:
                classes("badge-warning")
            case PayoutAttemptStatus.failed:
                classes("badge-error")
            case PayoutAttemptStatus.pending:
                classes("badge-neutral")
        text(status.value.replace("_", " ").title())
    yield


class PayoutAttemptStatusColumn(
    datatable.DatatableAttrColumn[PayoutAttempt, PayoutSortProperty]
):
    def render(self, request: Request, item: PayoutAttempt) -> Generator[None] | None:
        with payout_attempt_status_badge(item.status):
            pass
        return None


class PayoutAttemptProcessorIdColumn(
    datatable.DatatableAttrColumn[PayoutAttempt, PayoutSortProperty]
):
    def __init__(self) -> None:
        super().__init__("processor_id", "Processor ID", clipboard=True)

    def render(self, request: Request, item: PayoutAttempt) -> Generator[None] | None:
        if item.processor_id is None:
            text("N/A")
            return None

        if item.processor == AccountType.stripe:
            with tag.a(
                href=f"https://dashboard.stripe.com/payouts/{item.processor_id}",
                classes="link flex flex-row gap-1 items-center",
            ):
                attr("target", "_blank")
                attr("rel", "noopener noreferrer")
                text(item.processor_id)
                with tag.div(classes="icon-external-link"):
                    pass
        else:
            text(item.processor_id)
        return None


@router.get("/", name="payouts:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    query: str | None = Query(None),
    status: Annotated[
        PayoutStatus | None,
        BeforeValidator(empty_str_to_none),
        Query(),
    ] = None,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = PayoutRepository.from_session(session)
    statement = repository.get_base_statement()

    # Apply query filter - search across multiple fields
    if query is not None:
        try:
            # Try to parse as UUID first (could be payout ID, account ID, or organization ID)
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    Payout.id == query_uuid,
                    Payout.account_id == query_uuid,
                    # Search by organization ID via account relationship
                    Payout.account_id.in_(
                        select(Account.id).where(
                            Account.id.in_(
                                select(Organization.account_id).where(
                                    Organization.id == query_uuid
                                )
                            )
                        )
                    ),
                )
            )
        except ValueError:
            # If not a UUID, search in string fields
            query_lower = query.lower()
            statement = statement.where(
                or_(
                    Payout.id.in_(
                        select(PayoutAttempt.payout_id).where(
                            PayoutAttempt.processor_id.ilike(f"%{query_lower}%")
                        )
                    ),
                    func.lower(Payout.invoice_number).ilike(f"%{query_lower}%"),
                )
            )

    # Apply status filter
    if status is not None:
        statement = statement.where(Payout.status == status)

    statement = repository.apply_sorting(statement, sorting)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [("Payouts", str(request.url_for("payouts:list")))],
        "payouts:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Payouts")

            # Filter controls
            with tag.form(method="GET", classes="w-full flex flex-col gap-4"):
                with tag.div(classes="flex flex-row gap-2"):
                    with input.search(
                        "query",
                        query,
                        placeholder="Search by ID, account ID, organization ID, processor ID, or invoice number...",
                    ):
                        pass
                    with input.select(
                        [
                            ("All Statuses", ""),
                            *[
                                (status.value.replace("_", " ").title(), status.value)
                                for status in PayoutStatus
                            ],
                        ],
                        status[0] if status else "",
                        name="status",
                    ):
                        pass
                    with button(type="submit"):
                        text("Filter")

            # Data table
            with datatable.Datatable[Payout, PayoutSortProperty](
                datatable.DatatableAttrColumn(
                    "id", "ID", href_route_name="payouts:get", clipboard=True
                ),
                datatable.DatatableAttrColumn("account_id", "Account ID"),
                PayoutStatusColumn(
                    "status", "Status", sorting=PayoutSortProperty.status
                ),
                datatable.DatatableCurrencyColumn(
                    "amount", "Amount", sorting=PayoutSortProperty.amount
                ),
                datatable.DatatableCurrencyColumn(
                    "fees_amount", "Fees", sorting=PayoutSortProperty.fees_amount
                ),
                datatable.DatatableDateTimeColumn(
                    "created_at", "Created At", sorting=PayoutSortProperty.created_at
                ),
                datatable.DatatableDateTimeColumn("paid_at", "Paid At"),
            ).render(request, items, sorting=sorting):
                pass

            # Pagination
            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="payouts:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = PayoutRepository.from_session(session)
    payout = await repository.get_by_id(id, options=(joinedload(Payout.account),))

    if payout is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (f"Payout {payout.id}", str(request.url)),
            ("Payouts", str(request.url_for("payouts:list"))),
        ],
        "payouts:get",
    ):
        with tag.div(classes="flex flex-col gap-8"):
            with tag.h1(classes="text-4xl"):
                text(f"Payout {payout.id}")

            # Payout details
            with tag.div(classes="card card-border w-full shadow-sm"):
                with tag.div(classes="card-body"):
                    with tag.h2(classes="card-title"):
                        text("Payout Details")

                    with description_list.DescriptionList[Payout](
                        description_list.DescriptionListAttrItem(
                            "id", "ID", clipboard=True
                        ),
                        PayoutStatusListItem("status", "Status"),
                        description_list.DescriptionListCurrencyItem(
                            "amount", "Amount"
                        ),
                        description_list.DescriptionListCurrencyItem(
                            "fees_amount", "Fees"
                        ),
                        description_list.DescriptionListCurrencyItem(
                            "gross_amount", "Gross Amount"
                        ),
                        description_list.DescriptionListDateTimeItem(
                            "created_at", "Created At"
                        ),
                        description_list.DescriptionListDateTimeItem(
                            "paid_at", "Paid At"
                        ),
                        description_list.DescriptionListAttrItem(
                            "processor", "Processor"
                        ),
                        description_list.DescriptionListAttrItem(
                            "invoice_number", "Invoice Number"
                        ),
                    ).render(request, payout):
                        pass

            # Account details
            with tag.div(classes="card card-border w-full shadow-sm"):
                with tag.div(classes="card-body"):
                    with tag.h2(classes="card-title"):
                        text("Account Details")

                    with description_list.DescriptionList[Payout](
                        description_list.DescriptionListAttrItem(
                            "account.account_type", "Account Processor"
                        ),
                        PayoutAccountProcessorIdListItem(),
                    ).render(request, payout):
                        pass

            with tag.div():
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-2xl font-bold"):
                        text(f"Payout Attempts ({len(payout.attempts)})")

                    with tag.div(classes="flex justify-end gap-2"):
                        if (
                            payout.status == PayoutStatus.failed
                            or len(payout.attempts) == 0
                        ):
                            with tag.button(
                                classes="btn btn-primary",
                                hx_get=str(
                                    request.url_for("payouts:retry", id=payout.id)
                                ),
                                hx_target="#modal",
                            ):
                                text("Retry Payout")
                        if payout.status.is_cancelable():
                            with tag.button(
                                classes="btn btn-error",
                                hx_get=str(
                                    request.url_for("payouts:cancel", id=payout.id)
                                ),
                                hx_target="#modal",
                            ):
                                text("Cancel Payout")

                with datatable.Datatable[PayoutAttempt, PayoutSortProperty](
                    datatable.DatatableAttrColumn("id", "Attempt ID", clipboard=True),
                    PayoutAttemptStatusColumn("status", "Status"),
                    PayoutAttemptProcessorIdColumn(),
                    datatable.DatatableCurrencyColumn("amount", "Amount"),
                    datatable.DatatableDateTimeColumn("created_at", "Created At"),
                    datatable.DatatableDateTimeColumn("paid_at", "Paid At"),
                    datatable.DatatableAttrColumn("failed_reason", "Failure Reason"),
                ).render(request, payout.attempts):
                    pass


@router.api_route("/{id}/retry", name="payouts:retry", methods=["GET", "POST"])
async def retry(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = PayoutRepository.from_session(session)
    payout = await repository.get_by_id(id)

    if payout is None:
        raise HTTPException(status_code=404)

    if request.method == "POST":
        # Enqueue the payout task
        enqueue_job("payout.trigger_stripe_payout", payout_id=payout.id)

        await add_toast(
            request, f"Payout retry enqueued for payout {payout.id}", variant="success"
        )

        # Close the modal and refresh the page
        with tag.div(hx_redirect=str(request.url_for("payouts:get", id=payout.id))):
            pass
        return

    # GET method - show confirmation modal
    with modal(f"Retry Payout {payout.id}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text(f"Are you sure you want to retry payout {payout.id}?")

            with tag.p():
                text("This will:")
            with tag.ul(classes="list-disc list-inside"):
                with tag.li():
                    text("Create a new payout attempt")
                with tag.li():
                    text("Trigger a new Stripe payout")
                with tag.li():
                    text("Update the payout status accordingly")

            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with tag.form(method="dialog"):
                    with button(
                        type="button",
                        variant="primary",
                        hx_post=str(request.url_for("payouts:retry", id=payout.id)),
                        hx_target="#modal",
                    ):
                        text("Retry")


@router.api_route("/{id}/cancel", name="payouts:cancel", methods=["GET", "POST"])
async def cancel(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = PayoutRepository.from_session(session)
    payout = await repository.get_by_id(
        id,
        options=(
            joinedload(Payout.account),
            joinedload(Payout.transactions).options(
                joinedload(Transaction.account),
                joinedload(Transaction.payout),
            ),
        ),
    )

    if payout is None:
        raise HTTPException(status_code=404)

    if request.method == "POST":
        await payout_service.cancel(session, payout)
        await add_toast(request, f"Payout {payout.id} canceled", variant="success")

        # Close the modal and refresh the page
        with tag.div(hx_redirect=str(request.url_for("payouts:get", id=payout.id))):
            pass
        return

    # GET method - show confirmation modal
    with modal(f"Cancel Payout {payout.id}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text(f"Are you sure you want to cancel payout {payout.id}?")

            with tag.p():
                text("This will:")
            with tag.ul(classes="list-disc list-inside"):
                with tag.li():
                    text("Reverse the money to the account balance")
                with tag.li():
                    text("Mark the payout as canceled")

            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with tag.form(method="dialog"):
                    with button(
                        type="button",
                        variant="primary",
                        hx_post=str(request.url_for("payouts:cancel", id=payout.id)),
                        hx_target="#modal",
                    ):
                        text("Cancel")
