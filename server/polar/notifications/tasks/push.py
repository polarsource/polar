from datetime import datetime, timedelta
from uuid import UUID

import structlog
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
)

from polar.device.service import device as device_service
from polar.notifications.service import notifications
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

log = structlog.get_logger()


def send_push_message(token: str, message: str, extra: dict | None = None) -> None:
    """Send a push message to a specific device token."""
    try:
        response = PushClient().publish(
            PushMessage(
                to=token,
                body=message,
                data=extra,
                title="Polar",
                sound="default",
                ttl=60 * 60 * 24,
                expiration=datetime.now() + timedelta(days=1),
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


@task("notifications.push")
async def notifications_push(
    ctx: JobContext,
    notification_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            notif = await notifications.get(session, notification_id)
            if not notif:
                log.warning("notifications.push.not_found")
                return

            devices = await device_service.list_by_user(
                session=session, user_id=notif.user_id, expo_push_token=None
            )
            if not devices:
                log.warning("notifications.push.user_not_found", user_id=notif.user_id)
                return

            for device in devices:
                if not device.expo_push_token:
                    log.warning(
                        "notifications.push.no_push_token", user_id=device.user_id
                    )
                    continue

                notification_type = notifications.parse_payload(notif)
                subject = notification_type.subject()

                try:
                    send_push_message(
                        token=device.expo_push_token,
                        message=subject,
                        extra={"notification_id": str(notification_id)},
                    )
                except Exception as e:
                    log.error(
                        "notifications.push.send_failed",
                        error=str(e),
                        user_id=device.user_id,
                        notification_id=notification_id,
                    )
                    return
