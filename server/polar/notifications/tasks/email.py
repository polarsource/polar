from uuid import UUID
from jinja2 import StrictUndefined
import structlog
from polar.models.user import User

from polar.notifications.schemas import (
    IssuePledgeCreated,
    IssuePledgedBranchCreated,
    IssuePledgedPullRequestCreated,
    IssuePledgedPullRequestMerged,
    MaintainerIssueBranchCreated,
    MaintainerIssuePullRequestCreated,
    MaintainerIssuePullRequestMerged,
    NotificationType,
)
from polar.worker import JobContext, PolarWorkerContext, task
from polar.postgres import AsyncSessionLocal
from polar.models.notification import Notification
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.user.service import user as user_service
from polar.notifications.sender import get_email_sender
from polar.notifications.service import TNotificationPayloads, notifications
from polar.postgres import AsyncSession

from jinja2.nativetypes import NativeEnvironment

log = structlog.get_logger()

sender = get_email_sender()


@task("notifications.send")
async def notifications_send(
    ctx: JobContext,
    notification_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionLocal() as session:
            notif: Notification | None = await Notification.find(
                session, notification_id
            )
            if not notif:
                log.warning("notifications.send.not_found")
                return

            # Get users to send to
            user = await user_service.get(session, notif.user_id)
            if not user:
                log.warning("notifications.send.user_not_found", user_id=notif.user_id)
                return

            if not await should_send(session, user, notif):
                return

            if not user.email:
                log.warning("notifications.send.user_no_email", user_id=user.id)
                return

            meta = notifications.parse_payload(notif)

            html = render_email(user, NotificationType.from_str(notif.type), meta)
            if not html:
                log.error(
                    "notifications.send.could_not_render",
                    user=user,
                    notif=notif,
                )
                return

            sender.send_to_user(
                to_email_addr=user.email,
                subject="[Polar] " + meta.issue_title,
                html_content=html,
            )


async def should_send(session: AsyncSession, user: User, notif: Notification) -> bool:
    # TODO: do we need personal notification and email preferences?
    if not notif.organization_id:
        return True

    # Use user notificaiton preferences in the org that this notification originates
    # from
    settings = await user_organization_service.get_settings(
        session, user_id=user.id, org_id=notif.organization_id
    )

    match notif.type:
        case NotificationType.issue_pledge_created:
            return settings.email_notification_maintainer_issue_receives_backing

        case NotificationType.issue_pledged_branch_created:
            return settings.email_notification_backed_issue_branch_created

        case NotificationType.issue_pledged_pull_request_created:
            return settings.email_notification_backed_issue_pull_request_created

        case NotificationType.issue_pledged_pull_request_merged:
            return settings.email_notification_backed_issue_pull_request_merged

        case NotificationType.maintainer_issue_branch_created:
            return settings.email_notification_maintainer_issue_branch_created

        case NotificationType.maintainer_issue_pull_request_created:
            return settings.email_notification_maintainer_pull_request_created

        case NotificationType.maintainer_issue_pull_request_merged:
            return settings.email_notification_maintainer_pull_request_merged

    return False


def get_template(type: NotificationType, meta: TNotificationPayloads) -> str | None:
    if type == NotificationType.issue_pledge_created and isinstance(
        meta, IssuePledgeCreated
    ):
        return MAINTAINER_PLEDGE_CREATED

    if type == NotificationType.issue_pledged_branch_created and isinstance(
        meta, IssuePledgedBranchCreated
    ):
        return PLEDGER_ISSUE_BRANCH_CREATED

    if type == NotificationType.issue_pledged_pull_request_created and isinstance(
        meta, IssuePledgedPullRequestCreated
    ):
        return PLEDGER_ISSUE_PULL_REQUEST_CREATED

    if type == NotificationType.issue_pledged_pull_request_merged and isinstance(
        meta, IssuePledgedPullRequestMerged
    ):
        return PLEDGER_ISSUE_PULL_REQUEST_MERGED

    if type == NotificationType.maintainer_issue_branch_created and isinstance(
        meta, MaintainerIssueBranchCreated
    ):
        return MAINTAINER_ISSUE_BRANCH_CREATED

    if type == NotificationType.maintainer_issue_pull_request_created and isinstance(
        meta, MaintainerIssuePullRequestCreated
    ):
        return MAINTAINER_ISSUE_PULL_REQUEST_CREATED

    if type == NotificationType.maintainer_issue_pull_request_merged and isinstance(
        meta, MaintainerIssuePullRequestMerged
    ):
        return MAINTAINER_ISSUE_PULL_REQUEST_MERGED

    return None


def render_email(
    user: User,
    type: NotificationType,
    meta: TNotificationPayloads,
) -> str | None:
    template = get_template(type, meta)
    if not template:
        log.error("email.no_template_found", typ=type)
        return None

    m: dict[str, str] = meta.dict()
    m["username"] = user.username

    env = NativeEnvironment(undefined=StrictUndefined)
    t = env.from_string(template)
    res = t.render(m)
    return res


MAINTAINER_PLEDGE_CREATED = """Hi {{username}},<br><br>

{{pledger_name}} has pledged ${{pledge_amount}} to <a href="{{issue_url}}">{{issue_title}}</a>.
"""  # noqa: E501

PLEDGER_ISSUE_PULL_REQUEST_CREATED = """Hi {{username}},<br><br>

{{pull_request_creator_username}} just opened a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that solves
the issue <a href="{{issue_url}}">{{issue_title}}</a> that you've backed!
"""  # noqa: E501

PLEDGER_ISSUE_PULL_REQUEST_MERGED = """Hi {{username}},<br><br>

{{pull_request_creator_username}} just merged a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that solves
the issue <a href="{{issue_url}}">{{issue_title}}</a> that you've backed!<br><br>

The money will soon be paid out to {{repo_owner}}.<br><br>

If the issue is not solved, dispute the pledge within 14 days from the <a href="https://dashboard.polar/sh">Polar</a> dashboard, or by replying to this email.
"""  # noqa: E501

PLEDGER_ISSUE_BRANCH_CREATED = """Hi {{username}},<br><br>

Polar has detected that {{branch_creator_username}} has started to work on a fix to <a href="{{issue_url}}">{{issue_title}}</a> that you've backed.
"""  # noqa: E501


MAINTAINER_ISSUE_PULL_REQUEST_CREATED = """Hi {{username}},<br><br>

{{pull_request_creator_username}} just opened a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that solves
the issue <a href="{{issue_url}}">{{issue_title}}</a> that has been pledged on Polar.
"""  # noqa: E501

MAINTAINER_ISSUE_PULL_REQUEST_MERGED = """Hi {{username}},<br><br>

{{pull_request_creator_username}} just merged a <a href="{{pull_request_url}}">pull request</a> to {{repo_owner}}/{{repo_name}} that solves
the issue <a href="{{issue_url}}">{{issue_title}}</a> that has been pledged on Polar.<br><br>

Check <a href="https://dashboard.polar.sh/">polar.sh</a> to manage your payout details.
"""  # noqa: E501

MAINTAINER_ISSUE_BRANCH_CREATED = """Hi {{username}},<br><br>

Polar has detected that {{branch_creator_username}} has started to work on a fix to <a href="{{issue_url}}">{{issue_title}}</a> that has been pledged on Polar.
"""  # noqa: E501
