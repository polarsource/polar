from fastapi import Depends
from fastapi.responses import StreamingResponse
from pydantic import UUID4

from polar.account.service import account as account_service
from polar.auth.dependencies import WebUser
from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSessionMaker
from polar.locker import Locker, get_locker
from polar.models import Payout
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session, get_db_sessionmaker
from polar.routing import APIRouter

from .schemas import Payout as PayoutSchema
from .schemas import PayoutCreate, PayoutEstimate
from .service import payout as payout_service

router = APIRouter(prefix="/payouts", tags=["payouts", APITag.private])


@router.get("/estimate", response_model=PayoutEstimate)
async def get_estimate(
    auth_subject: WebUser,
    account_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> PayoutEstimate:
    account = await account_service.get(session, auth_subject, account_id)
    if account is None:
        raise ResourceNotFound()

    return await payout_service.estimate(session, account=account)


@router.post("/", response_model=PayoutSchema, status_code=201)
async def create(
    auth_subject: WebUser,
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
    auth_subject: WebUser,
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
