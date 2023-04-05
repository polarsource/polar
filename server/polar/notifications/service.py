from typing import Sequence, Tuple
from uuid import UUID
from pydantic import BaseModel
from sqlalchemy import desc
import structlog
from polar.exceptions import IntegrityError
from polar.kit.extensions.sqlalchemy import sql
from polar.models.pledge import Pledge
from polar.pledge.service import pledge
from polar.models.notification import Notification
from polar.models.user_organization import UserOrganization
from polar.models.issue import Issue
from polar.notifications.schemas import NotificationType
from polar.postgres import AsyncSession

log = structlog.get_logger()


class PartialNotification(BaseModel):
    issue_id: UUID | None = None
    pledge_id: UUID | None = None
    pull_request_id: UUID | None = None


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
            session.add(
                Notification(
                    organization_id=org_id,
                    type=typ,
                    issue_id=notif.issue_id,
                    pledge_id=notif.pledge_id,
                    pull_request_id=notif.pull_request_id,
                    dedup_key=dedup_key,
                )
            )
            await nested.commit()
            await session.commit()
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


notifications = NotificationsService()
