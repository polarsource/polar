import contextlib
import uuid
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import func, or_, select
from tagflow import classes, tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import Payout, PayoutAttempt
from polar.models.payout import PayoutStatus
from polar.payout.repository import PayoutRepository
from polar.payout.sorting import ListSorting, PayoutSortProperty
from polar.postgres import AsyncSession, get_db_session

from ..components import button, datatable, description_list, input
from ..layout import layout

router = APIRouter()


@contextlib.contextmanager
def payout_status_badge(status: PayoutStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == PayoutStatus.succeeded:
            classes("badge-success")
        elif status == PayoutStatus.in_transit:
            classes("badge-warning")
        elif status == PayoutStatus.pending:
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
            # Try to parse as UUID first (could be payout ID or account ID)
            query_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    Payout.id == query_uuid,
                    Payout.account_id == query_uuid,
                )
            )
        except ValueError:
            # If not a UUID, search in string fields
            query_lower = query.lower()
            statement = statement.where(
                or_(
                    Payout.id.in_(
                        select(PayoutAttempt.payout_id).where(
                            PayoutAttempt.processor_id.ilike("%{query_lower}%")
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
                        placeholder="Search by ID, account ID, processor ID, or invoice number...",
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
    payout = await repository.get_by_id(id)

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
                        description_list.DescriptionListAttrItem(
                            "account_id", "Account ID"
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
                            "processor_id", "Processor ID", clipboard=True
                        ),
                        description_list.DescriptionListAttrItem(
                            "invoice_number", "Invoice Number"
                        ),
                    ).render(request, payout):
                        pass
