import json
from uuid import UUID
import structlog

from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal
from polar.models.notification import Notification
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.user.service import user as user_service
from polar.notifications.sender import get_email_sender

log = structlog.get_logger()

sender = get_email_sender()


@task("notifications.send")
async def sync_repositories(
    ctx: JobContext,
    notification_id: UUID,
) -> None:
    async with AsyncSessionLocal() as session:
        notif: Notification | None = await Notification.find(session, notification_id)
        if not notif:
            log.warning("notifications.send.not_found")
            return

        # Get users to send to
        users = await user_organization_service.list_by_org(
            session, notif.organization_id
        )
        if not users:
            log.warning("notifications.send.users_not_found")
            return

        for user_org in users:
            user = await user_service.get(session, user_org.user_id)

            if not user:
                log.warning(
                    "notifications.send.user_not_found", user_id=user_org.user_id
                )
                continue

            if not user.email:
                log.warning("notifications.send.user_no_email", user_id=user.id)
                continue

            sender.send_to_user(user.email, "HELLO EMAIL:" + str(notif.id))
