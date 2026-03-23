from uuid import UUID

import structlog

from polar.email.sender import enqueue_email_template
from polar.notifications.service import notifications
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log = structlog.get_logger()


@actor(actor_name="notifications.send", priority=TaskPriority.LOW)
async def notifications_send(notification_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        notif = await notifications.get(session, notification_id)
        if not notif:
            log.warning("notifications.send.not_found")
            return

        notification_type = notifications.parse_payload(notif)

        enqueue_email_template(
            notification_type.to_email(),
            to_email_addr=notif.user.email,
            subject=notification_type.subject(),
        )
