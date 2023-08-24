import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.models.notification import Notification
from polar.postgres import AsyncSession, get_db_session

from .schemas import (
    NotificationRead,
    NotificationsList,
    NotificationsMarkRead,
    NotificationType,
)
from .service import notifications

router = APIRouter(tags=["notifications"])


log = structlog.get_logger()


@router.get("/notifications", response_model=NotificationsList)
async def get(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> NotificationsList:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    notifs = await notifications.get_for_user(session, auth.user.id)

    def decorate(n: Notification) -> NotificationRead | None:
        try:
            return NotificationRead(
                id=n.id,
                type=NotificationType.from_str(n.type),
                created_at=n.created_at,
                payload=notifications.parse_payload(n),
            )
        except Exception as e:
            log.error("failed to parse notification", e=e)
            return None

    res = [decorate(n) for n in notifs]
    list = [v for v in res if v is not None]

    last_read_notification_id = await notifications.get_user_last_read(
        session, auth.user.id
    )

    return NotificationsList(
        notifications=list, last_read_notification_id=last_read_notification_id
    )


@router.post("/notifications/read")
async def mark_read(
    read: NotificationsMarkRead,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    await notifications.set_user_last_read(session, auth.user.id, read.notification_id)
    return None
