from uuid import UUID

import structlog

from polar.email.sender import get_email_sender
from polar.models.notification import Notification
from polar.models.user import User
from polar.notifications.schemas import (
    NotificationType,
)
from polar.notifications.service import notifications
from polar.postgres import AsyncSession
from polar.user.service import user as user_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

log = structlog.get_logger()

sender = get_email_sender()


@task("notifications.send")
async def notifications_send(
    ctx: JobContext,
    notification_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            notif: Notification | None = await Notification.find(
                session, notification_id
            )
            if not notif:
                log.warning("notifications.send.not_found")
                return

            # TODO: support sending to "notif.email_addr"

            # Get users to send to
            user = await user_service.get(session, notif.user_id)
            if not user:
                log.warning("notifications.send.user_not_found", user_id=notif.user_id)
                return

            if not user.email:
                log.warning("notifications.send.user_no_email", user_id=user.id)
                return

            notification_type = notifications.parse_payload(notif)

            (subject, body) = notification_type.render(user)
            if not subject or not body:
                log.error(
                    "notifications.send.could_not_render",
                    user=user,
                    notif=notif,
                )
                return

            sender.send_to_user(
                to_email_addr=user.email,
                subject=f"[Polar] {subject}",
                html_content=body,
            )
