from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Wallet
from polar.models.wallet import WalletType
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Wallet as WalletSchema
from .schemas import WalletID, WalletNotFound, WalletTopUpCreate
from .service import MissingPaymentMethodError, PaymentIntentFailedError
from .service import wallet as wallet_service

router = APIRouter(prefix="/wallets", tags=["wallets", APITag.private])


@router.get("/", summary="List Wallets", response_model=ListResource[WalletSchema])
async def list(
    auth_subject: auth.WalletsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    type: MultipleQueryFilter[WalletType] | None = Query(
        None, title="Wallet Type Filter", description="Filter by wallet type."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[WalletSchema]:
    """List wallets."""
    results, count = await wallet_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        type=type,
        customer_id=customer_id,
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


@router.post(
    "/{id}/top-up",
    summary="Top-Up Wallet",
    response_model=WalletSchema,
    responses={
        201: {"description": "Wallet topped up successfully."},
        400: {
            "description": "The payment request failed.",
            "model": PaymentIntentFailedError.schema(),
        },
        404: WalletNotFound,
        402: {
            "description": "No payment method available.",
            "model": MissingPaymentMethodError.schema(),
        },
    },
)
async def top_up(
    id: WalletID,
    top_up_create: WalletTopUpCreate,
    auth_subject: auth.WalletsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Wallet:
    """
    Top-up a wallet by adding funds to its balance.

    The customer should have a valid payment method on file.
    """
    wallet = await wallet_service.get(session, auth_subject, id)

    if wallet is None:
        raise ResourceNotFound()

    await wallet_service.top_up(session, wallet, top_up_create.amount)

    return wallet
