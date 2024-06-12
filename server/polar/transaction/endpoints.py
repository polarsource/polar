from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from polar.account.service import account as account_service
from polar.auth.dependencies import WebUser
from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Transaction as TransactionModel
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession, get_db_session, get_db_sessionmaker

from .schemas import (
    PayoutCreate,
    PayoutEstimate,
    Transaction,
    TransactionDetails,
    TransactionsSummary,
)
from .service.payout import payout_transaction as payout_transaction_service
from .service.transaction import SearchSortProperty
from .service.transaction import transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


SearchSorting = Annotated[
    list[Sorting[SearchSortProperty]],
    Depends(SortingGetter(SearchSortProperty, ["-created_at"])),
]


@router.get("/search", response_model=ListResource[Transaction])
async def search_transactions(
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    auth_subject: WebUser,
    type: TransactionType | None = Query(None),
    account_id: UUID4 | None = Query(None),
    payment_user_id: UUID4 | None = Query(None),
    payment_organization_id: UUID4 | None = Query(None),
    exclude_platform_fees: bool = Query(False),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[Transaction]:
    results, count = await transaction_service.search(
        session,
        auth_subject.subject,
        type=type,
        account_id=account_id,
        payment_user_id=payment_user_id,
        payment_organization_id=payment_organization_id,
        exclude_platform_fees=exclude_platform_fees,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Transaction.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get("/lookup", response_model=TransactionDetails)
async def lookup_transaction(
    transaction_id: UUID4,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> TransactionDetails:
    return TransactionDetails.model_validate(
        await transaction_service.lookup(session, transaction_id, auth_subject.subject)
    )


@router.get("/summary", response_model=TransactionsSummary)
async def get_summary(
    auth_subject: WebUser,
    account_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> TransactionsSummary:
    account = await account_service.get(session, account_id)
    if account is None:
        raise ResourceNotFound("Account not found")

    return await transaction_service.get_summary(
        session, auth_subject.subject, account, authz
    )


@router.get("/payouts", response_model=PayoutEstimate)
async def get_payout_estimate(
    auth_subject: WebUser,
    account_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PayoutEstimate:
    account = await account_service.get(session, account_id)
    if account is None:
        raise ResourceNotFound("Account not found")

    if not await authz.can(auth_subject.subject, AccessType.write, account):
        raise NotPermitted()

    return await payout_transaction_service.get_payout_estimate(
        session, account=account
    )


@router.post("/payouts", response_model=Transaction, status_code=201)
async def create_payout(
    auth_subject: WebUser,
    payout_create: PayoutCreate,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> TransactionModel:
    account_id = payout_create.account_id
    account = await account_service.get(session, account_id)
    if account is None:
        raise ResourceNotFound("Account not found")

    if not await authz.can(auth_subject.subject, AccessType.write, account):
        raise NotPermitted()

    return await payout_transaction_service.create_payout(session, account=account)


@router.get("/payouts/{id}/csv")
async def get_payout_csv(
    id: UUID4,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
    authz: Authz = Depends(Authz.authz),
) -> StreamingResponse:
    payout = await payout_transaction_service.get(session, id)

    if payout is None:
        raise ResourceNotFound("Payout not found")

    assert payout.account_id is not None
    account = await account_service.get(session, payout.account_id)
    assert account is not None

    if not await authz.can(auth_subject.subject, AccessType.write, account):
        raise NotPermitted()

    content = payout_transaction_service.get_payout_csv(
        sessionmaker, account=account, payout=payout
    )
    filename = f"polar-payout-{payout.created_at.isoformat()}.csv"

    return StreamingResponse(
        content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
