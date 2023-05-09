from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.invite.schemas import InviteRead
from .schemas import BackofficePledgeRead
from polar.postgres import AsyncSession, get_db_session

from polar.pledge.service import pledge as pledge_service
from polar.invite.service import invite as invite_service

from .pledge_service import bo_pledges_service


router = APIRouter(tags=["backoffice"], prefix="/backoffice")


@router.get("/pledges", response_model=list[BackofficePledgeRead])
async def pledges(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[BackofficePledgeRead]:
    return await bo_pledges_service.list_pledges(session, customers=True)


@router.get("/pledges/non_customers", response_model=list[BackofficePledgeRead])
async def pledges_non_customers(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[BackofficePledgeRead]:
    return await bo_pledges_service.list_pledges(session, customers=False)


async def get_pledge(session: AsyncSession, pledge_id: UUID) -> BackofficePledgeRead:
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )
    return BackofficePledgeRead.from_db(pledge)


@router.post("/pledges/approve/{pledge_id}", response_model=BackofficePledgeRead)
async def pledge_approve(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficePledgeRead:
    await pledge_service.transfer(session, pledge_id)
    return await get_pledge(session, pledge_id)


@router.post("/pledges/mark_pending/{pledge_id}", response_model=BackofficePledgeRead)
async def pledge_mark_pending(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficePledgeRead:
    await pledge_service.mark_pending_by_pledge_id(session, pledge_id)
    return await get_pledge(session, pledge_id)


@router.post("/pledges/mark_disputed/{pledge_id}", response_model=BackofficePledgeRead)
async def pledge_mark_disputed(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficePledgeRead:
    await pledge_service.mark_disputed(
        session, pledge_id, by_user_id=auth.user.id, reason="Disputed via Backoffice"
    )
    return await get_pledge(session, pledge_id)


@router.post("/invites/create_code", response_model=InviteRead)
async def invites_create_code(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> InviteRead:
    res = await invite_service.create_code(session, auth.user)
    if not res:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )
    return InviteRead.from_db(res)


@router.post("/invites/list", response_model=list[InviteRead])
async def invites_list(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[InviteRead]:
    res = await invite_service.list(session)
    return [InviteRead.from_db(i) for i in res]
