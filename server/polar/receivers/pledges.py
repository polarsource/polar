from typing import Any
from polar.context import PolarContext
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
async def mark_pledges_pending_on_issue_close(
    ctx: PolarContext, *, item: Issue, session: AsyncSession, **values: Any
):
    if item.state == "closed":
        await pledge_service.mark_pending_by_issue_id(session, item.id)


@pledge_created.connect
async def pledge_created_state_notifications(
    ctx: PolarContext, *, item: Pledge, session: AsyncSession, **values: Any
):
    if item.state == "created":
        await pledge_created_notification(item, session)


@pledge_updated.connect
async def pledge_updated_state_notifications(
    ctx: PolarContext, *, item: Pledge, session: AsyncSession, **values: Any
):
    if item.state == "created":
        # TODO: find a way to do this only when the state transitions from
        # "initiated" -> "created".
        await pledge_created_notification(item, session)


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
