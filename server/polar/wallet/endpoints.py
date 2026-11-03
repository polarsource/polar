from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Wallet
from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Wallet as WalletSchema
from .schemas import WalletID, WalletListParams, WalletNotFound
from .service import wallet as wallet_service

router = APIRouter(prefix="/wallets", tags=["wallets", APITag.private])


@router.get("/", summary="List Wallets", response_model=ListResource[WalletSchema])
async def list(
    filters: Annotated[WalletListParams, Query()],
    auth_subject: auth.WalletsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[WalletSchema]:
    """List wallets."""
    results, count = await wallet_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        type=filters.type,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [WalletSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Wallet",
    response_model=WalletSchema,
    responses={404: WalletNotFound},
)
async def get(
    id: WalletID,
    auth_subject: auth.WalletsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Wallet:
    """Get a wallet by ID."""
    wallet = await wallet_service.get(session, auth_subject, id)

    if wallet is None:
        raise ResourceNotFound()

    return wallet
