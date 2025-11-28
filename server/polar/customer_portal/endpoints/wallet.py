from typing import Annotated

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Wallet
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter
from polar.wallet.schemas import WalletID, WalletNotFound

from .. import auth
from ..schemas.wallet import CustomerWallet
from ..service.wallet import customer_wallet as customer_wallet_service
from ..sorting.wallet import CustomerWalletSortProperty

router = APIRouter(prefix="/wallets", tags=["wallets", APITag.public])

ListSorting = Annotated[
    list[Sorting[CustomerWalletSortProperty]],
    Depends(SortingGetter(CustomerWalletSortProperty, ["-created_at"])),
]


@router.get("/", summary="List Wallets", response_model=ListResource[CustomerWallet])
async def list(
    auth_subject: auth.CustomerPortalRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerWallet]:
    """List wallets of the authenticated customer."""
    results, count = await customer_wallet_service.list(
        session,
        auth_subject,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerWallet.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Wallet",
    response_model=CustomerWallet,
    responses={404: WalletNotFound},
)
async def get(
    id: WalletID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> Wallet:
    """Get a wallet by ID for the authenticated customer."""
    wallet = await customer_wallet_service.get_by_id(session, auth_subject, id)

    if wallet is None:
        raise ResourceNotFound()

    return wallet
