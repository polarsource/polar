from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
import structlog
from polar.models import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.repository import Repository
from polar.notifications.notification import (
    MaintainerPledgeCreatedNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
)
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.notifications.service import (
    PartialNotification,
    get_cents_in_dollar_string,
    notifications as notification_service,
)
from polar.issue.service import issue as issue_service
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.pledge.hooks import (
    PledgeHook,
    PledgePaidHook,
    pledge_created as pledge_created_hook,
    pledge_pending as pledge_pending_hook,
    pledge_paid as pledge_paid_hook,
    pledge_updated as pledge_updated_hook,
)
from polar.config import settings
from polar.issue.hooks import IssueHook, issue_upserted

log = structlog.get_logger()


async def mark_pledges_pending_on_issue_close(
    hook: IssueHook,
):
    if hook.issue.state == "closed":
        await pledge_service.mark_pending_by_issue_id(hook.session, hook.issue.id)


issue_upserted.add(mark_pledges_pending_on_issue_close)


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


def issue_url(org: Organization, repo: Repository, issue: Issue) -> str:
    return f"https://github.com/{org.name}/{repo.name}/issues/{issue.number}"


def pledger_name(pledge: Pledge) -> str:
    if pledge.organization:
        return pledge.organization.name
    if pledge.user:
        return pledge.user.username
    return "anonymous"


async def pledge_created_notification(pledge: Pledge, session: AsyncSession):
    issue = await issue_service.get_by_id(session, pledge.issue_id)
    if not issue:
        log.error("pledge_created_notification.no_issue_found")
        return

    org: Organization | None = await organization_service.get(
        session, issue.organization_id
    )
    if not org:
        log.error("pledge_created_notification.no_org_found")
        return

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
        maintainer_has_stripe_account=True if org.account else False,
    )

    await notification_service.send_to_org(
        session=session,
        org_id=org.id,
        notif=PartialNotification(
            issue_id=pledge.issue_id, pledge_id=pledge.id, payload=n
        ),
    )


async def pledge_pending_notification(pledge: Pledge, session: AsyncSession):
    issue = await issue_service.get_by_id(session, pledge.issue_id)
    if not issue:
        log.error("pledge_pending_notification.no_issue_found")
        return

    org = await organization_service.get(session, issue.organization_id)
    if not org:
        log.error("pledge_pending_notification.no_org_found")
        return

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        log.error("pledge_pending_notification.no_repo_found")
        return

    n = MaintainerPledgePendingNotification(
        pledger_name=pledger_name(pledge),
        pledge_amount=get_cents_in_dollar_string(pledge.amount),
        issue_url=issue_url(org, repo, issue),
        issue_title=issue.title,
        issue_org_name=org.name,
        issue_repo_name=repo.name,
        issue_number=issue.number,
        maintainer_has_stripe_account=True if org.account else False,
    )

    await notification_service.send_to_org(
        session=session,
        org_id=org.id,
        notif=PartialNotification(
            issue_id=pledge.issue_id, pledge_id=pledge.id, payload=n
        ),
    )

    # Send to pledger
    pledger_notif = PledgerPledgePendingNotification(
        pledge_amount=get_cents_in_dollar_string(pledge.amount),
        pledge_date=pledge.created_at.strftime("%Y-%m-%d"),
        issue_url=issue_url(org, repo, issue),
        issue_title=issue.title,
        issue_org_name=org.name,
        issue_repo_name=repo.name,
        issue_number=issue.number,
    )

    await notification_service.send_to_pledger(
        session,
        pledge,
        notif=PartialNotification(
            issue_id=pledge.issue_id, pledge_id=pledge.id, payload=pledger_notif
        ),
    )


async def pledge_paid_notification(
    pledge: Pledge, transaction: PledgeTransaction, session: AsyncSession
):
    issue = await issue_service.get_by_id(session, pledge.issue_id)
    if not issue:
        log.error("pledge_paid_notification.no_issue_found")
        return

    org = await organization_service.get(session, issue.organization_id)
    if not org:
        log.error("pledge_paid_notification.no_org_found")
        return

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        log.error("pledge_paid_notification.no_repo_found")
        return

    n = MaintainerPledgePaidNotification(
        issue_url=issue_url(org, repo, issue),
        issue_title=issue.title,
        issue_org_name=org.name,
        issue_repo_name=repo.name,
        issue_number=issue.number,
        paid_out_amount=get_cents_in_dollar_string(transaction.amount),
    )

    await notification_service.send_to_org(
        session=session,
        org_id=org.id,
        notif=PartialNotification(
            issue_id=pledge.issue_id, pledge_id=pledge.id, payload=n
        ),
    )


async def hook_pledge_created_notifications(hook: PledgeHook):
    session = hook.session
    pledge = hook.pledge
    await pledge_created_notification(pledge, session)


pledge_created_hook.add(hook_pledge_created_notifications)


async def hook_pledge_pending_notifications(hook: PledgeHook):
    session = hook.session
    pledge = hook.pledge
    await pledge_pending_notification(pledge, session)


pledge_pending_hook.add(hook_pledge_pending_notifications)


async def hook_pledge_paid_notifications(hook: PledgePaidHook):
    session = hook.session
    pledge = hook.pledge
    transaction = hook.transaction
    await pledge_paid_notification(pledge, transaction, session)


pledge_paid_hook.add(hook_pledge_paid_notifications)
