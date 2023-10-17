import structlog
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

from polar.account.service import account as account_service
from polar.config import settings
from polar.issue.hooks import IssueHook, issue_upserted
from polar.issue.service import issue as issue_service
from polar.models import Issue
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.notifications.notification import (
    MaintainerPledgeCreatedNotification,
)
from polar.notifications.service import (
    PartialNotification,
    get_cents_in_dollar_string,
)
from polar.notifications.service import (
    notifications as notification_service,
)
from polar.organization.service import organization as organization_service
from polar.pledge.hooks import (
    PledgeHook,
)
from polar.pledge.hooks import (
    pledge_created as pledge_created_hook,
)
from polar.pledge.hooks import (
    pledge_updated as pledge_updated_hook,
)
from polar.pledge.schemas import PledgeType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.repository.service import repository as repository_service

log = structlog.get_logger()


async def mark_pledges_confirmation_pending_on_issue_close(
    hook: IssueHook,
) -> None:
    if hook.issue.state == "closed":
        # Only do this if the issue has pledges
        pledges = await pledge_service.get_by_issue_ids(hook.session, [hook.issue.id])
        if len(pledges) == 0:
            return

        # Mark pledges in "created" as "confirmation_pending"
        changed = await issue_service.mark_needs_confirmation(
            hook.session, hook.issue.id
        )

        # Send notifications
        if changed:
            await pledge_service.pledge_confirmation_pending_notifications(
                hook.session, hook.issue.id
            )
    else:
        await issue_service.mark_not_needs_confirmation(hook.session, hook.issue.id)


issue_upserted.add(mark_pledges_confirmation_pending_on_issue_close)


async def pledge_created_discord_alert(hook: PledgeHook) -> None:
    session = hook.session
    pledge = hook.pledge

    if not settings.DISCORD_WEBHOOK_URL:
        return

    webhook = AsyncDiscordWebhook(
        url=settings.DISCORD_WEBHOOK_URL, content="New pledge"
    )

    issue = await issue_service.get(session, pledge.issue_id)
    if not issue:
        return

    embed = DiscordEmbed(
        title="New pledge",
        description=f'A ${pledge.amount/100} pledge has been made towards "{issue.title}".',  # noqa: E501
        color="65280",
    )

    embed.add_embed_field(
        name="Backoffice",
        value="[Open](https://polar.sh/backoffice/pledges)",
    )

    embed.add_embed_field(
        name="Type",
        value=pledge.type,
    )

    webhook.add_embed(embed)
    await webhook.execute()


pledge_created_hook.add(pledge_created_discord_alert)


async def pledge_created_issue_pledge_sum(hook: PledgeHook) -> None:
    session = hook.session
    pledge = hook.pledge
    await pledge_service.set_issue_pledged_amount_sum(session, pledge.issue_id)


pledge_created_hook.add(pledge_created_issue_pledge_sum)
pledge_updated_hook.add(pledge_created_issue_pledge_sum)


def issue_url(org: Organization, repo: Repository, issue: Issue) -> str:
    return f"https://github.com/{org.name}/{repo.name}/issues/{issue.number}"


def pledger_name(pledge: Pledge) -> str:
    if pledge.by_organization:
        return pledge.by_organization.name
    return pledge.user.username if pledge.user else "anonymous"


async def pledge_created_notification(pledge: Pledge, session: AsyncSession) -> None:
    issue = await issue_service.get(session, pledge.issue_id)
    if not issue:
        log.error("pledge_created_notification.no_issue_found")
        return

    org: Organization | None = await organization_service.get(
        session, issue.organization_id
    )
    if not org:
        log.error("pledge_created_notification.no_org_found")
        return

    org_account: Account | None = await account_service.get_by_org(session, org.id)

    repo: Repository | None = await repository_service.get(session, issue.repository_id)
    if not repo:
        log.error("pledge_created_notification.no_repo_found")
        return

    n = MaintainerPledgeCreatedNotification(
        pledger_name=pledger_name(pledge),
        pledge_amount=get_cents_in_dollar_string(pledge.amount),
        issue_url=issue_url(org, repo, issue),
        issue_title=issue.title,
        issue_org_name=org.name,
        issue_repo_name=repo.name,
        issue_number=issue.number,
        maintainer_has_stripe_account=True if org_account else False,
        pledge_id=pledge.id,
        pledge_type=PledgeType.from_str(pledge.type),
    )

    await notification_service.send_to_org(
        session=session,
        org_id=org.id,
        notif=PartialNotification(
            issue_id=pledge.issue_id, pledge_id=pledge.id, payload=n
        ),
    )


async def hook_pledge_created_notifications(hook: PledgeHook) -> None:
    session = hook.session
    pledge = hook.pledge
    await pledge_created_notification(pledge, session)


pledge_created_hook.add(hook_pledge_created_notifications)
