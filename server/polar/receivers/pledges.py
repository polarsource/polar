from polar.issue.signals import issue_updated
from polar.models import Issue
from polar.models.pledge import Pledge
from polar.notifications.schemas import NotificationType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.pledge.signals import pledge_created, pledge_updated
from polar.notifications.service import (
    PartialNotification,
    notifications as notification_service,
)
from polar.issue.service import issue as issue_service


@issue_updated.connect
async def mark_pledges_pending_on_issue_close(issue: Issue, session: AsyncSession):
    if issue.state == "closed":
        await pledge_service.mark_pending_by_issue_id(session, issue.id)


@pledge_created.connect
async def pledge_created_state_notifications(pledge: Pledge, session: AsyncSession):
    if pledge.state == "created":
        await pledge_created_notification(pledge, session)


@pledge_updated.connect
async def pledge_updated_state_notifications(pledge: Pledge, session: AsyncSession):
    if pledge.state == "created":
        # TODO: find a way to do this only when the state transitions from
        # "initiated" -> "created".
        await pledge_created_notification(pledge, session)


async def pledge_created_notification(pledge: Pledge, session: AsyncSession):
    issue = await issue_service.get_by_id(session, pledge.issue_id)
    if not issue:
        return

    await notification_service.create_for_issue(
        session,
        issue,
        NotificationType.issue_pledge_created,
        notif=PartialNotification(
            issue_id=issue.id,
            pledge_id=pledge.id,
        ),
    )
