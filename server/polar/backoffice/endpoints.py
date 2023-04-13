from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.kit.extensions.sqlalchemy import sql
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, get_db_session

from polar.pledge.schemas import PledgeRead
from polar.pledge.service import pledge as pledge_service


router = APIRouter(tags=["backoffice"], prefix="/backoffice")


@router.get("/pledges", response_model=list[PledgeRead])
async def pledges(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PledgeRead]:
    stmt = sql.select(Pledge)
    res = await session.execute(stmt)
    pledges = res.scalars().unique().all()
    return [PledgeRead.from_db(p) for p in pledges]


@router.post("/pledges/approve/{pledge_id}", response_model=PledgeRead)
async def pledge_approve(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    await pledge_service.transfer(session, pledge_id)
    p = await pledge_service.get(session, pledge_id)
    if not p:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )
    return PledgeRead.from_db(p)


@router.post("/pledges/mark_pending/{pledge_id}", response_model=PledgeRead)
async def pledge_mark_pending(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    await pledge_service.mark_pending_by_pledge_id(session, pledge_id)
    p = await pledge_service.get(session, pledge_id)
    if not p:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )
    return PledgeRead.from_db(p)
