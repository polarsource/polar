from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import UUID4

from polar.account.service import account as account_service
from polar.auth.dependencies import UserRequiredAuth
from polar.authz.service import Authz
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Transaction as TransactionModel
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .schemas import Transaction, TransactionDetails, TransactionsSummary
from .service.transaction import SearchSortProperty
from .service.transaction import transaction as transaction_service

router = APIRouter(prefix="/transactions", tags=["transactions"])


SearchSorting = Annotated[
    list[Sorting[SearchSortProperty]],
    Depends(SortingGetter(SearchSortProperty, ["-created_at"])),
]


@router.get("/search", response_model=ListResource[Transaction], tags=[Tags.PUBLIC])
async def search_transactions(
    pagination: PaginationParamsQuery,
    sorting: SearchSorting,
    auth: UserRequiredAuth,
    type: TransactionType | None = Query(None),
    account_id: UUID4 | None = Query(None),
    payment_user_id: UUID4 | None = Query(None),
    payment_organization_id: UUID4 | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[Transaction]:
    results, count = await transaction_service.search(
        session,
        auth.subject,
        type=type,
        account_id=account_id,
        payment_user_id=payment_user_id,
        payment_organization_id=payment_organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [Transaction.from_orm(result) for result in results],
        count,
        pagination,
    )


@router.get("/lookup", response_model=TransactionDetails, tags=[Tags.PUBLIC])
async def lookup_transaction(
    transaction_id: UUID4,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> TransactionModel:
    return await transaction_service.lookup(session, transaction_id, auth.subject)


@router.get("/summary", response_model=TransactionsSummary, tags=[Tags.PUBLIC])
async def get_summary(
    auth: UserRequiredAuth,
    account_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> TransactionsSummary:
    account = await account_service.get(session, account_id)
    if account is None:
        raise ResourceNotFound("Account not found")

    return await transaction_service.get_summary(session, auth.subject, account, authz)
