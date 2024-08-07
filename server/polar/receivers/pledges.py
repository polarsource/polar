import structlog
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
from slack_sdk.webhook import WebhookClient as SlackWebhookClient

from polar.account.service import account as account_service
from polar.config import settings
from polar.external_organization.service import (
    external_organization as external_organization_service,
)
from polar.issue.hooks import IssueHook, issue_upserted
from polar.issue.service import issue as issue_service
from polar.kit.money import get_cents_in_dollar_string
from polar.models import Issue
from polar.models.account import Account
from polar.models.external_organization import ExternalOrganization
from polar.models.pledge import Pledge, PledgeType
from polar.models.repository import Repository
from polar.notifications.notification import (
    MaintainerPledgeCreatedNotificationPayload,
    NotificationType,
)
from polar.notifications.service import (
    PartialNotification,
)
from polar.notifications.service import (
    notifications as notification_service,
)
from polar.pledge.hooks import (
    PledgeHook,
)
from polar.pledge.hooks import (
    pledge_created as pledge_created_hook,
)
from polar.pledge.hooks import (
    pledge_updated as pledge_updated_hook,
)
from polar.pledge.schemas import Pledger
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.repository.service import repository as repository_service
from polar.webhook_notifications.service import webhook_notifications_service

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


async def pledge_created_backoffice_discord_alert(hook: PledgeHook) -> None:
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


pledge_created_hook.add(pledge_created_backoffice_discord_alert)


async def pledge_created_webhook_alerts(hook: PledgeHook) -> None:
    session = hook.session
    pledge = hook.pledge

    external_organization = await external_organization_service.get_linked(
        session, pledge.organization_id
    )
    if external_organization is None:
        return

    organization = external_organization.safe_organization

    issue = await issue_service.get(session, pledge.issue_id)
    if issue is None:
        return

    repo = await repository_service.get(session, pledge.repository_id)
    if repo is None:
        return

    webhooks = await webhook_notifications_service.search(
        session, organization_id=organization.id
    )

    _pledge_amount = pledge.amount / 100
    _issue_polar_url = (
        f"https://polar.sh/{organization.slug}/{repo.name}/issues/{issue.number}"
    )
    _issue_github_url = (
        f"https://github.com/{organization.slug}/{repo.name}/issues/{issue.number}"
    )

    description = (
        f"A ${_pledge_amount} pledge has been made towards [{repo.name}#{issue.number}]({_issue_github_url}): "
        f"\n > `{issue.title}`."
    )

    for wh in webhooks:
        if wh.integration == "discord":
            webhook = AsyncDiscordWebhook(url=wh.url, content="New Pledge Received")

            embed = DiscordEmbed(
                title="New pledge Received",
                description=description,
                color="65280",
            )

            embed.set_thumbnail(url=settings.THUMBNAIL_URL)
            embed.set_author(name="Polar.sh", icon_url=settings.FAVICON_URL)
            embed.add_embed_field(
                name="Polar.sh",
                value=f"[View on Polar.sh]({_issue_polar_url})",
                inline=True,
            )
            embed.add_embed_field(
                name="Issue",
                value=f"[View on GitHub]({_issue_github_url})",
                inline=True,
            )
            embed.add_embed_field(
                name="Amount", value=f"${_pledge_amount}", inline=True
            )
            embed.set_footer(text="Powered by Polar.sh")

            webhook.add_embed(embed)
            await webhook.execute()
            continue

        if wh.integration == "slack":
            slack_webhook = SlackWebhookClient(wh.url)
            response = slack_webhook.send(
                text=description,
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": description,
                        },
                        "accessory": {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Open"},
                            "url": f"https://polar.sh/{organization.slug}/{repo.name}/issues/{issue.number}",
                        },
                    },
                ],
            )


pledge_created_hook.add(pledge_created_webhook_alerts)


async def pledge_created_issue_pledge_sum(hook: PledgeHook) -> None:
    session = hook.session
    pledge = hook.pledge
    await pledge_service.set_issue_pledged_amount_sum(session, pledge.issue_id)


pledge_created_hook.add(pledge_created_issue_pledge_sum)
pledge_updated_hook.add(pledge_created_issue_pledge_sum)


def issue_url(org: ExternalOrganization, repo: Repository, issue: Issue) -> str:
    return f"https://github.com/{org.name}/{repo.name}/issues/{issue.number}"


def pledger_name(pledge: Pledge) -> str | None:
    pledger = Pledger.from_pledge(pledge)
    if pledger:
        return pledger.name
    return None


async def pledge_created_notification(pledge: Pledge, session: AsyncSession) -> None:
    issue = await issue_service.get(session, pledge.issue_id)
    if not issue:
        log.error("pledge_created_notification.no_issue_found")
        return

    external_organization = await external_organization_service.get_linked(
        session, issue.organization_id
    )

    if not external_organization:
        log.error("pledge_created_notification.no_external_org_found")
        return

    organization = external_organization.safe_organization
    org_account: Account | None = await account_service.get_by_organization_id(
        session, organization.id
    )

    repo: Repository | None = await repository_service.get(session, issue.repository_id)
    if not repo:
        log.error("pledge_created_notification.no_repo_found")
        return

    n = MaintainerPledgeCreatedNotificationPayload(
        pledger_name=pledger_name(pledge),
        pledge_amount=get_cents_in_dollar_string(pledge.amount),
        issue_url=issue_url(external_organization, repo, issue),
        issue_title=issue.title,
        issue_org_name=external_organization.name,
        issue_repo_name=repo.name,
        issue_number=issue.number,
        maintainer_has_stripe_account=True if org_account else False,
        pledge_id=pledge.id,
        pledge_type=PledgeType.from_str(pledge.type),
    )

    await notification_service.send_to_org_members(
        session=session,
        org_id=organization.id,
        notif=PartialNotification(
            issue_id=pledge.issue_id,
            pledge_id=pledge.id,
            type=NotificationType.maintainer_pledge_created,
            payload=n,
        ),
    )


async def hook_pledge_created_notifications(hook: PledgeHook) -> None:
    session = hook.session
    pledge = hook.pledge
    await pledge_created_notification(pledge, session)


pledge_created_hook.add(hook_pledge_created_notifications)
