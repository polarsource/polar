from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.auth.dependencies import WebUser
from polar.device import auth
from polar.device.schemas import DeviceCreate, DevicePlatform, DeviceSchema
from polar.device.service import device as device_service
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import NotificationsList, NotificationsMarkRead
from .service import notifications

DeviceID = Annotated[UUID4, Path(description="The device ID.")]

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
    "/notifications/subscribe",
    response_model=DeviceSchema,
    status_code=201,
    summary="Subscribes a device to notifications",
    responses={201: {"description": "Device subscribed to notifications."}},
)
async def create(
    device_create: DeviceCreate,
    auth_subject: auth.DeviceWrite,
    session: AsyncSession = Depends(get_db_session),
) -> DeviceSchema:
    """Create a device."""
    device = await device_service.create(session, device_create, auth_subject)
    return DeviceSchema.model_validate(device)


@router.get(
    "/notifications/subscriptions",
    response_model=list[DeviceSchema],
    status_code=200,
    summary="Lists all devices subscribed to notifications",
)
async def list(
    auth_subject: auth.DeviceRead,
    session: AsyncSession = Depends(get_db_session),
    expo_push_token: str | None = Query(None, description="Filter by Expo push token."),
    platform: DevicePlatform | None = Query(None, description="Filter by platform."),
) -> list[DeviceSchema]:
    """List all devices subscribed to notifications."""
    devices = await device_service.list_by_user(
        session, auth_subject.subject.id, expo_push_token, platform
    )
    return [DeviceSchema.model_validate(device) for device in devices]


@router.delete(
    "/notifications/unsubscribe/{id}",
    responses={
        204: {"description": "Device unsubscribed from notifications."},
        404: {"description": "Device not found."},
    },
)
async def delete(
    id: DeviceID,
    auth_subject: auth.DeviceWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a device."""
    await device_service.delete(session, auth_subject, id)
