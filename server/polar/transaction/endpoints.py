from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from pydantic import UUID4, AwareDatetime

from polar.account.service import account as account_service
from polar.auth.permission import OrganizationPermission
from polar.exceptions import ResourceNotFound
from polar.kit.csv import CSVStreamingResponse
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models.transaction import TransactionType
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter
from polar.transaction import (
    auth as transactions_auth,
)

from .export import (
    TransactionExportColumn,
    TransactionExportTimezone,
    generate_csv,
    get_filename,
)
from .schemas import Transaction, TransactionsSummary
from .service.transaction import TransactionSortProperty
from .service.transaction import transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions", APITag.private])


SearchSorting = Annotated[
    list[Sorting[TransactionSortProperty]],
    Depends(SortingGetter(TransactionSortProperty, ["-created_at"])),
]


@router.get("/search", response_model=ListResource[Transaction])
async def search_transactions(
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    auth_subject: transactions_auth.TransactionsRead,
    type: TransactionType | None = Query(None),
    account_id: UUID4 | None = Query(None),
    payment_customer_id: UUID4 | None = Query(None),
    payment_organization_id: UUID4 | None = Query(None),
    payment_user_id: UUID4 | None = Query(None),
    exclude_platform_fees: bool = Query(False),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[Transaction]:
    results, count = await transaction_service.search(
        session,
        auth_subject,
        type=type,
        account_id=account_id,
        payment_customer_id=payment_customer_id,
        payment_organization_id=payment_organization_id,
        payment_user_id=payment_user_id,
        exclude_platform_fees=exclude_platform_fees,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Transaction.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/export", summary="Export Income", response_class=CSVStreamingResponse)
async def export(
    auth_subject: transactions_auth.TransactionsRead,
    type: TransactionType | None = Query(None),
    account_id: UUID4 | None = Query(None),
    exclude_platform_fees: bool = Query(False),
    created_after: AwareDatetime | None = Query(
        None,
        description=(
            "Only include transactions created after this date. "
            "Must include a UTC offset."
        ),
    ),
    created_before: AwareDatetime | None = Query(
        None,
        description=(
            "Only include transactions created before this date. "
            "Must include a UTC offset."
        ),
    ),
    timezone: Annotated[
        TransactionExportTimezone,
        Query(description="Time zone used to render dates in the CSV."),
    ] = "UTC",
    columns: MultipleQueryFilter[TransactionExportColumn] | None = Query(
        None,
        description=(
            "Columns to include in the CSV, in order. "
            "Defaults to date, description, gross, fees, tax, net, "
            "status and payout date."
        ),
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CSVStreamingResponse:
    """Export income transactions as a CSV file."""
    tzinfo = ZoneInfo(timezone)
    return CSVStreamingResponse(
        generate_csv(
            session,
            auth_subject,
            type=type,
            account_id=account_id,
            exclude_platform_fees=exclude_platform_fees,
            created_after=created_after,
            created_before=created_before,
            timezone=tzinfo,
            columns=columns,
        ),
        get_filename(created_after, created_before, tzinfo),
    )


@router.get("/summary", response_model=TransactionsSummary)
async def get_summary(
    auth_subject: transactions_auth.TransactionsRead,
    account_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> TransactionsSummary:
    account = await account_service.get(
        session,
        auth_subject,
        account_id,
        permission=OrganizationPermission.finance_read,
    )
    if account is None:
        raise ResourceNotFound()

    return await transaction_service.get_summary(session, account)
