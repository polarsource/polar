from typing import Sequence, Union
from uuid import UUID
from pydantic import BaseModel, parse_obj_as
from sqlalchemy import desc
import structlog
from polar.exceptions import IntegrityError
from polar.kit.extensions.sqlalchemy import sql
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.pledge.service import pledge
from polar.models.notification import Notification
from polar.models.user_organization import UserOrganization
from polar.models.issue import Issue
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
from polar.postgres import AsyncSession
from polar.worker import enqueue_job
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service
from polar.pledge.service import pledge as pledge_service
from polar.pull_request.service import pull_request as pull_request_service
from fastapi.encoders import jsonable_encoder

log = structlog.get_logger()

TNotificationPayloads = Union[
    IssuePledgeCreated,
    IssuePledgedBranchCreated,
    IssuePledgedPullRequestCreated,
    IssuePledgedPullRequestMerged,
    MaintainerIssueBranchCreated,
    MaintainerIssuePullRequestCreated,
    MaintainerIssuePullRequestMerged,
]


class PartialNotification(BaseModel):
    issue_id: UUID | None = None
    pledge_id: UUID | None = None
    pull_request_id: UUID | None = None
    issue_reference_id: UUID | None = None
    payload: Union[TNotificationPayloads, None, object] = None


class NotificationsService:
    async def get_for_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Notification]:

        stmt = (
            sql.select(Notification)
            .join(
                UserOrganization,
                UserOrganization.organization_id == Notification.organization_id,
            )
            .join(Pledge, Pledge.id == Notification.pledge_id, isouter=True)
            .join(Issue, Issue.id == Notification.issue_id, isouter=True)
            .join(
                PullRequest,
                PullRequest.id == Notification.pull_request_id,
                isouter=True,
            )
            .where(UserOrganization.user_id == user_id)
            .order_by(desc(Notification.created_at))
            .limit(100)
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def create_for_org(
        self,
        session: AsyncSession,
        org_id: UUID,
        typ: NotificationType,
        notif: PartialNotification,
    ) -> bool:

        log.warning("zegl create for org", typ=typ, notif=notif)

        dedup_key: str = "/".join(
            [
                str(org_id),
                str(typ),
                str(notif.issue_id) if notif.issue_id else "",
                str(notif.pledge_id) if notif.pledge_id else "",
                str(notif.pull_request_id) if notif.pull_request_id else "",
            ]
        )

        nested = await session.begin_nested()

        try:
            notification = Notification(
                organization_id=org_id,
                type=typ,
                issue_id=notif.issue_id,
                pledge_id=notif.pledge_id,
                pull_request_id=notif.pull_request_id,
                dedup_key=dedup_key,
                payload=jsonable_encoder(notif.payload),
            )

            session.add(notification)
            await nested.commit()
            await session.commit()
            await enqueue_job("notifications.send", notification_id=notification.id)
            return True
        except IntegrityError as e:
            await nested.rollback()
            await session.commit()
            return False

    async def create_for_issue(
        self,
        session: AsyncSession,
        issue: Issue,
        typ: NotificationType,
        notif: PartialNotification,
    ):
        # generate payload
        notif.payload = await self.create_payload(session, issue, typ, notif)

        # send to owning org
        if issue.organization_id:
            await self.create_for_org(
                session=session,
                org_id=issue.organization_id,
                typ=typ,
                notif=notif,
            )

    async def create_for_issue_pledgers(
        self,
        session: AsyncSession,
        issue: Issue,
        typ: NotificationType,
        notif: PartialNotification,
    ):
        sent_to: set[UUID] = set()

        # send to pledgers
        pledges = await pledge.get_by_issue_ids(session, [issue.id])
        if pledges:
            for p in pledges:
                if p.by_organization_id:

                    if p.by_organization_id in sent_to:
                        continue

                    await self.create_for_org(
                        session=session,
                        org_id=p.by_organization_id,
                        typ=typ,
                        notif=notif,
                    )

                    sent_to.add(p.by_organization_id)

    async def create_payload(
        self,
        session: AsyncSession,
        issue: Issue,
        typ: NotificationType,
        notif: PartialNotification,
    ) -> TNotificationPayloads:
        org = await organization_service.get(session, issue.organization_id)
        repo = await repository_service.get(session, issue.repository_id)

        if not org:
            raise Exception("no org found")

        if not repo:
            raise Exception("no repo found")

        issue_url = f"https://github.com/{org.name}/{repo.name}/issues/{issue.number}"

        if typ == NotificationType.issue_pledge_created:
            if not notif.pledge_id:
                raise Exception("no pledge_id set")
            pledge = await pledge_service.get(session, notif.pledge_id)
            if not pledge:
                raise Exception("no pledge found")

            # Build pledger name
            pledger_name = None
            if pledge.organization:
                pledger_name = pledge.organization.name
            elif pledge.user:
                pledger_name = pledge.user.username
            if not pledger_name:
                raise Exception("no pledger name found")

            return IssuePledgeCreated(
                pledger_name=pledger_name,
                issue_url=issue_url,
                issue_title=issue.title,
                issue_number=issue.number,
                pledge_amount=get_cents_in_dollar_string(pledge.amount),
            )

        if typ in [
            NotificationType.issue_pledged_pull_request_created,
            NotificationType.issue_pledged_pull_request_merged,
            NotificationType.maintainer_issue_pull_request_created,
            NotificationType.maintainer_issue_pull_request_merged,
        ]:
            if not notif.pull_request_id:
                raise Exception("no pull_request_id")
            pr = await pull_request_service.get(session, notif.pull_request_id)
            if not pr:
                raise Exception("no pull request found")

            pr_url = f"https://github.com/{org.name}/{repo.name}/pull/{pr.number}"

            log.error("zegl pr", pr=pr)

            if not pr.author:
                raise Exception("no pr author found")
            pull_request_creator_username = pr.author.get("login")
            if not pull_request_creator_username:
                raise Exception("no pr author username found")

            if typ == NotificationType.issue_pledged_pull_request_created:
                return IssuePledgedPullRequestCreated(
                    issue_url=issue_url,
                    issue_title=issue.title,
                    issue_number=issue.number,
                    pull_request_creator_username=pull_request_creator_username,
                    pull_request_title=pr.title,
                    pull_request_number=pr.number,
                    pull_request_url=pr_url,
                    repo_owner=org.name,
                    repo_name=repo.name,
                )

            if typ == NotificationType.maintainer_issue_pull_request_created:
                return MaintainerIssuePullRequestCreated(
                    issue_url=issue_url,
                    issue_title=issue.title,
                    issue_number=issue.number,
                    pull_request_creator_username=pull_request_creator_username,
                    pull_request_title=pr.title,
                    pull_request_number=pr.number,
                    pull_request_url=pr_url,
                    repo_owner=org.name,
                    repo_name=repo.name,
                )

            if typ == NotificationType.issue_pledged_pull_request_merged:
                return IssuePledgedPullRequestMerged(
                    issue_url=issue_url,
                    issue_title=issue.title,
                    issue_number=issue.number,
                    pull_request_creator_username=pull_request_creator_username,
                    pull_request_title=pr.title,
                    pull_request_number=pr.number,
                    pull_request_url=pr_url,
                    repo_owner=org.name,
                    repo_name=repo.name,
                )

            if typ == NotificationType.maintainer_issue_pull_request_merged:
                return MaintainerIssuePullRequestMerged(
                    issue_url=issue_url,
                    issue_title=issue.title,
                    issue_number=issue.number,
                    pull_request_creator_username=pull_request_creator_username,
                    pull_request_title=pr.title,
                    pull_request_number=pr.number,
                    pull_request_url=pr_url,
                    repo_owner=org.name,
                    repo_name=repo.name,
                )

        # Use externally constructed payloads
        if typ in [
            NotificationType.issue_pledged_branch_created,
            NotificationType.maintainer_issue_branch_created,
        ]:
            if typ == NotificationType.issue_pledged_branch_created and isinstance(
                notif.payload, IssuePledgedBranchCreated
            ):
                return notif.payload
            if typ == NotificationType.maintainer_issue_branch_created and isinstance(
                notif.payload, MaintainerIssueBranchCreated
            ):
                return notif.payload

        raise Exception("failed to generate notification payload")

    def parse_payload(self, n: Notification) -> TNotificationPayloads:
        tt = NotificationType.from_str(n.type)
        match tt:
            case NotificationType.issue_pledge_created:
                return parse_obj_as(IssuePledgeCreated, n.payload)

            case NotificationType.issue_pledged_branch_created:
                return parse_obj_as(IssuePledgedBranchCreated, n.payload)
            case NotificationType.issue_pledged_pull_request_created:
                return parse_obj_as(IssuePledgedPullRequestCreated, n.payload)
            case NotificationType.issue_pledged_pull_request_merged:
                return parse_obj_as(IssuePledgedPullRequestMerged, n.payload)

            case NotificationType.maintainer_issue_branch_created:
                return parse_obj_as(MaintainerIssueBranchCreated, n.payload)
            case NotificationType.maintainer_issue_pull_request_created:
                return parse_obj_as(MaintainerIssuePullRequestCreated, n.payload)
            case NotificationType.maintainer_issue_pull_request_merged:
                return parse_obj_as(MaintainerIssuePullRequestMerged, n.payload)

        raise Exception(f"unknown type={tt}")


def get_cents_in_dollar_string(cents: int) -> str:
    dollars = cents / 100
    if cents % 100 == 0:
        return "%d" % round(dollars)
    return "%.2f" % round(dollars, 2)


notifications = NotificationsService()
