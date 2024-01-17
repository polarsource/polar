import structlog
from fastapi import APIRouter, Depends

from polar.auth.dependencies import UserRequiredAuth
from polar.postgres import AsyncSession, get_db_session

from .schemas import NotificationsList, NotificationsMarkRead
from .service import notifications

router = APIRouter(tags=["notifications"])


log = structlog.get_logger()


@router.get("/notifications", response_model=NotificationsList)
async def get(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> NotificationsList:
    notifs = await notifications.get_for_user(session, auth.user.id)
    last_read_notification_id = await notifications.get_user_last_read(
        session, auth.user.id
    )

    return NotificationsList(
        notifications=notifs,  # type: ignore
        last_read_notification_id=last_read_notification_id,
    )


@router.post("/notifications/read")
async def mark_read(
    read: NotificationsMarkRead,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await notifications.set_user_last_read(session, auth.user.id, read.notification_id)
    return None
