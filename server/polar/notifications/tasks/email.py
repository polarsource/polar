from uuid import UUID
from jinja2 import StrictUndefined
from pydantic import BaseModel
import structlog

from polar.models.user import User
from polar.notifications.schemas import NotificationType
from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal
from polar.models.notification import Notification
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.user.service import user as user_service
from polar.notifications.sender import get_email_sender
from polar.pledge.service import pledge as pledge_service
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.postgres import AsyncSession

from jinja2.nativetypes import NativeEnvironment

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


class MetadataMaintainerPledgeCreated(BaseModel):
    username: str
    pledger_name: str
    issue_url: str
    issue_title: str
    pledge_amount: str


class MetadataPledgedIssuePullRequestCreated(BaseModel):
    username: str
    issue_url: str
    issue_title: str
    pull_request_url: str
    pull_request_title: str
    pull_request_creator_username: str
    repo_owner: str
    repo_name: str


async def email_metadata(
    session: AsyncSession, user: User, notif: Notification
) -> MetadataMaintainerPledgeCreated | MetadataPledgedIssuePullRequestCreated | None:

    if not notif.issue:
        log.warning(
            "render_email.no_issue",
            typ=notif.type,
            id=notif.id,
        )
        return None
    if not notif.pledge:
        log.warning(
            "render_email.no_pledge",
            typ=notif.type,
            id=notif.id,
        )
        return None

    org = await organization_service.get(session, notif.issue.organization_id)
    repo = await repository_service.get(session, notif.issue.repository_id)

    if not org:
        log.warning(
            "render_email.no_org",
            typ=notif.type,
            id=notif.id,
            org_id=notif.issue.organization_id,
        )
        return None

    if not repo:
        log.warning(
            "render_email.no_repo",
            typ=notif.type,
            id=notif.id,
            repo_id=notif.issue.repository_id,
        )
        return None

    issue_url = f"https://github.com/{org.name}/{repo.name}/issues/{notif.issue.number}"

    if notif.type == NotificationType.issue_pledge_created:
        # Build pledger name
        pledger_name = "anonymous"
        if notif.pledge and notif.pledge.organization:
            pledger_name = notif.pledge.organization.name
        elif notif.pledge and notif.pledge.user:
            pledger_name = notif.pledge.user.username

        return MetadataMaintainerPledgeCreated(
            username=user.username,
            pledger_name=pledger_name,
            issue_url=issue_url,
            issue_title=notif.issue.title,
            pledge_amount=get_cents_in_dollar_string(notif.pledge.amount),
        )

    if notif.type == NotificationType.issue_pledged_pull_request_created:

        pr = notif.pull_request
        if not pr:
            log.warning(
                "render_email.no_pr",
                typ=notif.type,
                id=notif.id,
            )
            return None

        pr_url = f"https://github.com/{org.name}/{repo.name}/pull/{pr.number}"

        if not pr.author or not pr.author.get("login"):
            log.warning(
                "render_email.no_pr_author",
                typ=notif.type,
                id=notif.id,
            )
            return None

        return MetadataPledgedIssuePullRequestCreated(
            username=user.username,
            issue_url=issue_url,
            issue_title=notif.issue.title,
            pull_request_creator_username=pr.author["login"],
            pull_request_title=pr.title,
            pull_request_url=pr_url,
            repo_owner=org.name,
            repo_name=repo.name,
        )

    return None


def render_email(
    meta: MetadataMaintainerPledgeCreated | MetadataPledgedIssuePullRequestCreated,
) -> str | None:

    template = None
    if isinstance(meta, MetadataMaintainerPledgeCreated):
        template = MAINTAINER_PLEDGE_CREATED
    if isinstance(meta, MetadataPledgedIssuePullRequestCreated):
        template = PLEDGER_ISSUE_PULL_REQUEST_CREATED

    if not template:
        return None

    env = NativeEnvironment(undefined=StrictUndefined)
    t = env.from_string(template)
    res = t.render(meta)
    return res


def get_cents_in_dollar_string(cents: int) -> str:
    dollars = cents / 100
    if cents % 100 == 0:
        return "%d" % round(dollars)
    return "%.2f" % round(dollars, 2)


MAINTAINER_PLEDGE_CREATED = """Hi {{username}},

{{pledger_name}} has pledged ${{pledge_amount}} to <a href="{{issue_url}}">{{issue_title}}</a>.
"""  # noqa: E501

PLEDGER_ISSUE_PULL_REQUEST_CREATED = """Hi {{username}},

{{pull_request_creator_username}} just opened a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that might solve
the issue <a href="{{issue_url}}">{{issue_title}}</a> that you've backed!
"""  # noqa: E501
