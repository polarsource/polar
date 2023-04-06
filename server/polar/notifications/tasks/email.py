from uuid import UUID
from jinja2 import StrictUndefined
import structlog
from polar.models.user import User

from polar.notifications.schemas import (
    MetadataMaintainerPledgeCreated,
    MetadataPledgedIssueBranchCreated,
    MetadataPledgedIssuePullRequestCreated,
    MetadataPledgedIssuePullRequestMerged,
)
from polar.worker import JobContext, task
from polar.postgres import AsyncSessionLocal
from polar.models.notification import Notification
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.user.service import user as user_service
from polar.notifications.sender import get_email_sender
from polar.notifications.service import notifications

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

            meta = notifications.parse_payload(notif)

            txt = render_email(user, meta)
            if not txt:
                log.error(
                    "notifications.send.could_not_render",
                    user=user,
                    notif=notif,
                )
                continue

            sender.send_to_user(user.email, txt)


def render_email(
    user: User,
    meta: MetadataMaintainerPledgeCreated
    | MetadataPledgedIssuePullRequestCreated
    | MetadataPledgedIssuePullRequestMerged
    | MetadataPledgedIssueBranchCreated,
) -> str | None:

    template = None
    if isinstance(meta, MetadataMaintainerPledgeCreated):
        template = MAINTAINER_PLEDGE_CREATED
    if isinstance(meta, MetadataPledgedIssuePullRequestCreated):
        template = PLEDGER_ISSUE_PULL_REQUEST_CREATED
    if isinstance(meta, MetadataPledgedIssuePullRequestMerged):
        template = PLEDGER_ISSUE_PULL_REQUEST_MERGED
    if isinstance(meta, MetadataPledgedIssueBranchCreated):
        template = PLEDGER_ISSUE_BRANCH_CREATED

    if not template:
        return None

    m: dict[str, str] = meta.dict()
    m["username"] = user.username

    env = NativeEnvironment(undefined=StrictUndefined)
    t = env.from_string(template)
    res = t.render(m)
    return res


MAINTAINER_PLEDGE_CREATED = """Hi {{username}},

{{pledger_name}} has pledged ${{pledge_amount}} to <a href="{{issue_url}}">{{issue_title}}</a>.
"""  # noqa: E501

PLEDGER_ISSUE_PULL_REQUEST_CREATED = """Hi {{username}},

{{pull_request_creator_username}} just opened a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that solves
the issue <a href="{{issue_url}}">{{issue_title}}</a> that you've backed!
"""  # noqa: E501

PLEDGER_ISSUE_PULL_REQUEST_MERGED = """Hi {{username}},

{{pull_request_creator_username}} just merged a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that solves
the issue <a href="{{issue_url}}">{{issue_title}}</a> that you've backed!

The money will soon be paid out to {{repo_owner}}.
"""  # noqa: E501

PLEDGER_ISSUE_BRANCH_CREATED = """Hi {{username}},

Polar has detected that {{branch_creator_username}} has started to work on a fix to <a href="{{issue_url}}">{{issue_title}}</a> that you've backed.
"""  # noqa: E501
