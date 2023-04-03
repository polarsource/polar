from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.postgres import AsyncSession, get_db_session

from .schemas import NotificationRead
from .service import notifications

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationRead])
async def get_repository_pull_requests(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[NotificationRead]:
    notifs = await notifications.get_for_user(session, auth.user.id)
    return [NotificationRead.from_orm(n) for n in notifs]
