from fastapi import Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from polar.account.service import account as account_service
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.locker import Locker, get_locker
from polar.models import Payout
from polar.models.payout import PayoutStatus
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session, get_db_sessionmaker
from polar.routing import APIRouter

from . import auth as payouts_auth
from . import sorting
from .schemas import Payout as PayoutSchema
from .schemas import PayoutCreate, PayoutEstimate, PayoutGenerateInvoice, PayoutInvoice
from .service import InsufficientBalance, UnderReviewAccount
from .service import payout as payout_service

router = APIRouter(prefix="/payouts", tags=["payouts", APITag.private])


@router.get("/", response_model=ListResource[PayoutSchema])
async def list(
    auth_subject: payouts_auth.PayoutsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    account_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="Account ID Filter", description="Filter by account ID."
    ),
    status: MultipleQueryFilter[PayoutStatus] | None = Query(
        None, title="Status Filter", description="Filter by payout status."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PayoutSchema]:
    """List payouts."""
    results, count = await payout_service.list(
        session,
        auth_subject,
        account_id=account_id,
        status=status,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [PayoutSchema.model_validate(result) for result in results], count, pagination
    )


@router.get(
    "/estimate",
    response_model=PayoutEstimate,
    responses={
        200: {
            "description": "Payout estimate computed successfully.",
        },
        400: {
            "description": "The balance is insufficient to create a payout.",
            "model": InsufficientBalance.schema(),
        },
        403: {
            "description": "The account is under review or not ready.",
            "model": UnderReviewAccount.schema(),
        },
        404: {"description": "Account not found.", "model": ResourceNotFound.schema()},
    },
)
async def get_estimate(
    auth_subject: payouts_auth.PayoutsRead,
    account_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> PayoutEstimate:
    account = await account_service.get(session, auth_subject, account_id)
    if account is None:
        raise ResourceNotFound()

    return await payout_service.estimate(session, account=account)


@router.post("/", response_model=PayoutSchema, status_code=201)
async def create(
    auth_subject: payouts_auth.PayoutsWrite,
    payout_create: PayoutCreate,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Payout:
    account_id = payout_create.account_id
    account = await account_service.get(session, auth_subject, account_id)
    if account is None:
        raise ResourceNotFound()

    return await payout_service.create(session, locker, account=account)


@router.get("/{id}/csv")
async def get_csv(
    id: UUID4,
    auth_subject: payouts_auth.PayoutsRead,
    session: AsyncSession = Depends(get_db_session),
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> StreamingResponse:
    payout = await payout_service.get(session, auth_subject, id)

    if payout is None:
        raise ResourceNotFound()

    content = payout_service.get_csv(session, sessionmaker, payout)
    filename = f"polar-payout-{payout.created_at.isoformat()}.csv"

    return StreamingResponse(
        content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/{id}/invoice", status_code=202)
async def generate_invoice(
    id: UUID4,
    payout_generate_invoice: PayoutGenerateInvoice,
    auth_subject: payouts_auth.PayoutsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Trigger generation of an order's invoice."""
    payout = await payout_service.get(session, auth_subject, id)

    if payout is None:
        raise ResourceNotFound()

    await payout_service.trigger_invoice_generation(
        session, payout, payout_generate_invoice
    )


@router.get("/{id}/invoice")
async def invoice(
    id: UUID4,
    auth_subject: payouts_auth.PayoutsRead,
    session: AsyncSession = Depends(get_db_session),
) -> PayoutInvoice:
    """Get an order's invoice data."""
    payout = await payout_service.get(session, auth_subject, id)

    if payout is None:
        raise ResourceNotFound()

    return await payout_service.get_invoice(payout)
