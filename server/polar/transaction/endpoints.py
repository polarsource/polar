from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Query
from pydantic import UUID4

from polar.account.service import account as account_service
from polar.auth.permission import OrganizationPermission
from polar.exceptions import ResourceNotFound
from polar.kit.csv import CSVStreamingResponse
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter
from polar.transaction import (
    auth as transactions_auth,
)

from .export import (
    TransactionExportParams,
    generate_csv,
    get_filename,
)
from .schemas import Transaction, TransactionSearchParams, TransactionsSummary
from .service.transaction import TransactionSortProperty
from .service.transaction import transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions", APITag.private])


SearchSorting = Annotated[
    list[Sorting[TransactionSortProperty]],
    Depends(SortingGetter(TransactionSortProperty, ["-created_at"])),
]


@router.get("/search", response_model=ListResource[Transaction])
async def search_transactions(
    filters: Annotated[TransactionSearchParams, Query()],
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    auth_subject: transactions_auth.TransactionsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[Transaction]:
    results, count = await transaction_service.search(
        session,
        auth_subject,
        type=filters.type,
        account_id=filters.account_id,
        payment_customer_id=filters.payment_customer_id,
        exclude_platform_fees=filters.exclude_platform_fees,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Transaction.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/export",
    summary="Export Transactions",
    response_class=CSVStreamingResponse,
    tags=[APITag.private],
)
async def export(
    filters: Annotated[TransactionExportParams, Query()],
    auth_subject: transactions_auth.TransactionsRead,
    account_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CSVStreamingResponse:
    """Export transactions as a CSV file."""
    account = await account_service.get(
        session,
        auth_subject,
        account_id,
        permission=OrganizationPermission.finance_read,
    )
    if account is None:
        raise ResourceNotFound()

    tzinfo = ZoneInfo(filters.timezone)
    return CSVStreamingResponse(
        generate_csv(
            session,
            account,
            type=filters.type,
            exclude_platform_fees=filters.exclude_platform_fees,
            created_after=filters.created_after,
            created_before=filters.created_before,
            timezone=tzinfo,
            columns=filters.columns,
        ),
        get_filename(filters.created_after, filters.created_before, tzinfo),
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
