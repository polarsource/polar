from fastapi import Depends

from polar.auth.dependencies import WebUser
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import NotificationsList, NotificationsMarkRead
from .service import notifications

router = APIRouter(tags=["notifications", APITag.private])


@router.get("/notifications", response_model=NotificationsList)
async def get(
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> NotificationsList:
    notifs = await notifications.get_for_user(session, auth_subject.subject.id)
    last_read_notification_id = await notifications.get_user_last_read(
        session, auth_subject.subject.id
    )

    return NotificationsList(
        notifications=notifs,  # type: ignore
        last_read_notification_id=last_read_notification_id,
    )


@router.post("/notifications/read")
async def mark_read(
    read: NotificationsMarkRead,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await notifications.set_user_last_read(
        session, auth_subject.subject.id, read.notification_id
    )
    return None
