from typing import Sequence

from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.kit.extensions.sqlalchemy import sql
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, get_db_session

from polar.pledge.schemas import PledgeRead


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
