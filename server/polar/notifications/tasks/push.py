from typing import TypedDict
from uuid import UUID

import structlog
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
)

from polar.notification_recipient.service import (
    notification_recipient as notification_recipient_service,
)
from polar.notifications.service import notifications
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log = structlog.get_logger()


class PushMessageExtra(TypedDict, total=False):
    notification_id: str


_push_client = PushClient()


def send_push_message(
    token: str, message: str, extra: PushMessageExtra | None = None
) -> None:
    """Send a push message to a specific device token."""
    try:
        response = _push_client.publish(
            PushMessage(
                to=token,
                body=message,
                data=extra,
                title="Polar",
                sound="default",
                ttl=60 * 60 * 24,
                expiration=None,
                priority="high",
                badge=1,
                category="default",
                display_in_foreground=True,
                channel_id="default",
                subtitle="",
                mutable_content=False,
            )
        )
    except PushServerError as exc:
        log.error("notifications.push.server_error", error=str(exc))
        raise
    except DeviceNotRegisteredError:
        log.warning("notifications.push.device_not_registered", token=token)
        raise
    except Exception as exc:
        log.error("notifications.push.unknown_error", error=str(exc))
        raise

    try:
        response.validate_response()
    except Exception as exc:
        log.error("notifications.push.validation_error", error=str(exc))
        raise


@actor(actor_name="notifications.push", priority=TaskPriority.LOW)
async def notifications_push(notification_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        notif = await notifications.get(session, notification_id)
        if not notif:
            log.warning("notifications.push.not_found")
            return

        notification_recipients = await notification_recipient_service.list_by_user(
            session=session,
            user_id=notif.user_id,
            expo_push_token=None,
            platform=None,
        )

        if not notification_recipients:
            log.warning("notifications.push.devices_not_found", user_id=notif.user_id)
            return

        for notification_recipient in notification_recipients:
            if not notification_recipient.expo_push_token:
                log.warning(
                    "notifications.push.no_push_token",
                    user_id=notification_recipient.user_id,
                )
                continue

            notification_type = notifications.parse_payload(notif)
            [subject, _] = notification_type.render()

            try:
                send_push_message(
                    token=notification_recipient.expo_push_token,
                    message=subject,
                    extra={"notification_id": str(notification_id)},
                )
            except Exception as e:
                log.error(
                    "notifications.push.send_failed",
                    error=str(e),
                    user_id=notification_recipient.user_id,
                    notification_id=notification_id,
                )
                return
