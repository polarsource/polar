from pydantic import parse_obj_as
from polar.models.issue_reference import IssueReference, ReferenceType
from polar.notifications.schemas import (
    MetadataMaintainerIssueBranchCreated,
    MetadataPledgedIssueBranchCreated,
    NotificationType,
)
from polar.postgres import AsyncSession
from polar.issue.signals import issue_reference_created, issue_reference_updated
from polar.notifications.service import (
    PartialNotification,
    notifications as notification_service,
)
from polar.issue.service import issue as issue_service
from polar.pull_request.service import pull_request as pull_request_service
from polar.models.issue_reference import ExternalGitHubCommitReference


@issue_reference_created.connect
async def issue_reference_created_notifications(
    ref: IssueReference, session: AsyncSession
):
    await issue_reference_notifications(ref, session)


@issue_reference_updated.connect
async def issue_reference_updated_notifications(
    ref: IssueReference, session: AsyncSession
):
    await issue_reference_notifications(ref, session)


async def issue_reference_notifications(ref: IssueReference, session: AsyncSession):
    if ref.reference_type == ReferenceType.PULL_REQUEST:
        issue = await issue_service.get_by_id(session, ref.issue_id)
        if not issue:
            return

        pr = await pull_request_service.get(session, ref.pull_request_id)
        if not pr:
            return

        if pr.state == "open":
            await notification_service.create_for_issue(
                session=session,
                issue=issue,
                typ=NotificationType.maintainer_issue_pull_request_created,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                ),
            )
            await notification_service.create_for_issue_pledgers(
                session=session,
                issue=issue,
                typ=NotificationType.issue_pledged_pull_request_created,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                ),
            )

        if pr.merged_at:
            await notification_service.create_for_issue(
                session=session,
                issue=issue,
                typ=NotificationType.maintainer_issue_pull_request_merged,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                ),
            )
            await notification_service.create_for_issue_pledgers(
                session=session,
                issue=issue,
                typ=NotificationType.issue_pledged_pull_request_merged,
                notif=PartialNotification(
                    issue_id=issue.id,
                    pull_request_id=pr.id,
                ),
            )

    if ref.reference_type == ReferenceType.EXTERNAL_GITHUB_COMMIT:
        issue = await issue_service.get_by_id(session, ref.issue_id)
        if not issue:
            return

        # ref.external_source

        ext_ref = parse_obj_as(ExternalGitHubCommitReference, ref.external_source)

        await notification_service.create_for_issue(
            session=session,
            issue=issue,
            typ=NotificationType.maintainer_issue_branch_created,
            notif=PartialNotification(
                issue_id=issue.id,
                payload=MetadataMaintainerIssueBranchCreated(
                    issue_url="https://github.com/TODO",
                    issue_title=issue.title,
                    branch_creator_username=ext_ref.user_login,
                    commit_link=f"https://github.com/{ext_ref.organization_name}/{ext_ref.repository_name}/commit/{ext_ref.commit_id}",
                ),
            ),
        )
        await notification_service.create_for_issue_pledgers(
            session=session,
            issue=issue,
            typ=NotificationType.issue_pledged_branch_created,
            notif=PartialNotification(
                issue_id=issue.id,
                # payload=super(MetadataPledgedIssueBranchCreated, payload),
                payload=MetadataPledgedIssueBranchCreated(
                    issue_url="https://github.com/TODO",
                    issue_title=issue.title,
                    branch_creator_username=ext_ref.user_login,
                    commit_link=f"https://github.com/{ext_ref.organization_name}/{ext_ref.repository_name}/commit/{ext_ref.commit_id}",
                ),
            ),
        )
