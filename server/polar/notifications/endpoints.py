from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.auth.dependencies import WebUser
from polar.notification_recipient import auth
from polar.notification_recipient.schemas import (
    NotificationRecipientCreate,
    NotificationRecipientPlatform,
    NotificationRecipientSchema,
)
from polar.notification_recipient.service import (
    notification_recipient as notification_recipient_service,
)
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import NotificationsList, NotificationsMarkRead
from .service import notifications

NotificationRecipientID = Annotated[
    UUID4, Path(description="The notification recipient ID.")
]

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


@router.post(
    "/notifications/recipients",
    response_model=NotificationRecipientSchema,
    status_code=201,
    summary="Subscribes a device to notifications",
    responses={201: {"description": "Device subscribed to notifications."}},
)
async def create(
    notification_recipient_create: NotificationRecipientCreate,
    auth_subject: auth.NotificationRecipientWrite,
    session: AsyncSession = Depends(get_db_session),
) -> NotificationRecipientSchema:
    """Create a notification recipient."""
    notification_recipient = await notification_recipient_service.create(
        session, notification_recipient_create, auth_subject
    )
    return NotificationRecipientSchema.model_validate(notification_recipient)


@router.get(
    "/notifications/recipients",
    response_model=list[NotificationRecipientSchema],
    status_code=200,
    summary="Lists all notification recipients subscribed to notifications",
)
async def list(
    auth_subject: auth.NotificationRecipientRead,
    session: AsyncSession = Depends(get_db_session),
    expo_push_token: str | None = Query(None, description="Filter by Expo push token."),
    platform: NotificationRecipientPlatform | None = Query(
        None, description="Filter by platform."
    ),
) -> list[NotificationRecipientSchema]:
    """List all devices subscribed to notifications."""
    notification_recipients = await notification_recipient_service.list_by_user(
        session, auth_subject.subject.id, expo_push_token, platform
    )
    return [
        NotificationRecipientSchema.model_validate(notification_recipient)
        for notification_recipient in notification_recipients
    ]


@router.delete(
    "/notifications/recipients/{id}",
    responses={
        204: {"description": "Notification recipient unsubscribed from notifications."},
        404: {"description": "Notification recipient not found."},
    },
)
async def delete(
    id: NotificationRecipientID,
    auth_subject: auth.NotificationRecipientWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a notification recipient."""
    await notification_recipient_service.delete(session, auth_subject, id)
