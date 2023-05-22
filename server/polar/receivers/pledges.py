from typing import Any

from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
from polar.context import PolarContext
from polar.issue.signals import issue_updated
from polar.models import Issue
from polar.models.pledge import Pledge
from polar.notifications.schemas import NotificationType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.notifications.service import (
    PartialNotification,
    notifications as notification_service,
)
from polar.issue.service import issue as issue_service
from polar.pledge.hooks import (
    PledgeHook,
    pledge_created as pledge_created_hook,
    pledge_updated as pledge_updated_hook,
)
from polar.config import settings


@issue_updated.connect
async def mark_pledges_pending_on_issue_close(
    ctx: PolarContext, *, item: Issue, session: AsyncSession, **values: Any
):
    if item.state == "closed":
        await pledge_service.mark_pending_by_issue_id(session, item.id)


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


async def pledge_created_discord_alert(hook: PledgeHook):
    session = hook.session
    pledge = hook.pledge

    if not settings.DISCORD_WEBHOOK_URL:
        return

    webhook = AsyncDiscordWebhook(
        url=settings.DISCORD_WEBHOOK_URL, content="New pledge"
    )

    issue = await issue_service.get_by_id(session, pledge.issue_id)
    if not issue:
        return

    embed = DiscordEmbed(
        title="New pledge",
        description=f'A ${pledge.amount/100} pledge has been made towards "{issue.title}"',  # noqa: E501
        color="65280",
    )

    embed.add_embed_field(
        name="Backoffice",
        value="[Open](https://dashboard.polar.sh/backoffice/pledges)",
    )

    webhook.add_embed(embed)
    await webhook.execute()


pledge_created_hook.add(pledge_created_discord_alert)


async def pledge_created_issue_pledge_sum(hook: PledgeHook):
    session = hook.session
    pledge = hook.pledge
    await pledge_service.set_issue_pledged_amount_sum(session, pledge.issue_id)


pledge_created_hook.add(pledge_created_issue_pledge_sum)
pledge_updated_hook.add(pledge_created_issue_pledge_sum)


async def hook_pledge_created_notifications(hook: PledgeHook):
    session = hook.session
    pledge = hook.pledge
    await pledge_created_notification(pledge, session)


pledge_created_hook.add(hook_pledge_created_notifications)
