from typing import Sequence, Union
from uuid import UUID
from pydantic import BaseModel, parse_obj_as
from sqlalchemy import desc
import structlog
from polar.kit.extensions.sqlalchemy import sql
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.user_notification import UserNotification
from polar.notifications.notification import (
    MaintainerPledgeCreatedNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    NotificationType,
    PledgerPledgePendingNotification,
)
from polar.pledge.service import pledge
from polar.models.notification import Notification
from polar.models.issue import Issue
from polar.postgres import AsyncSession
from polar.worker import enqueue_job
from fastapi.encoders import jsonable_encoder
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

log = structlog.get_logger()


class PartialNotification(BaseModel):
    issue_id: UUID | None = None
    pledge_id: UUID | None = None
    pull_request_id: UUID | None = None
    issue_reference_id: UUID | None = None
    payload: NotificationType


class NotificationsService:
    async def get_for_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Notification]:
        stmt = (
            sql.select(Notification)
            .join(Pledge, Pledge.id == Notification.pledge_id, isouter=True)
            .join(Issue, Issue.id == Notification.issue_id, isouter=True)
            .join(
                PullRequest,
                PullRequest.id == Notification.pull_request_id,
                isouter=True,
            )
            .where(Notification.user_id == user_id)
            .order_by(desc(Notification.created_at))
            .limit(100)
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def send_to_user(
        self,
        session: AsyncSession,
        user_id: UUID,
        notif: PartialNotification,
    ) -> bool:
        typ = type(notif.payload).__name__

        notification = Notification(
            user_id=user_id,
            type=typ,
            issue_id=notif.issue_id,
            pledge_id=notif.pledge_id,
            pull_request_id=notif.pull_request_id,
            payload=jsonable_encoder(notif.payload),
        )

        session.add(notification)
        await session.commit()
        await enqueue_job("notifications.send", notification_id=notification.id)
        return True

    async def send_to_org(
        self,
        session: AsyncSession,
        org_id: UUID,
        notif: PartialNotification,
    ) -> None:
        members = await user_organization_service.list_by_org(session, org_id)
        for member in members:
            await self.send_to_user(
                session=session,
                user_id=member.user_id,
                notif=notif,
            )

    async def send_to_anonymous_email(
        self,
        session: AsyncSession,
        email_addr: str,
        notif: PartialNotification,
    ) -> None:
        typ = type(notif.payload).__name__

        notification = Notification(
            email_addr=email_addr,
            type=typ,
            issue_id=notif.issue_id,
            pledge_id=notif.pledge_id,
            pull_request_id=notif.pull_request_id,
            payload=jsonable_encoder(notif.payload),
        )

        session.add(notification)
        await session.commit()
        await enqueue_job("notifications.send", notification_id=notification.id)

    async def create_for_issue(
        self,
        session: AsyncSession,
        issue: Issue,
        notif: PartialNotification,
    ):
        # send to owning org
        if issue.organization_id:
            # send
            await self.send_to_org(
                session=session,
                org_id=issue.organization_id,
                notif=notif,
            )

    async def create_for_issue_pledgers(
        self,
        session: AsyncSession,
        issue: Issue,
        notif: PartialNotification,
    ):
        sent_to_orgs: set[UUID] = set()

        # send to pledgers
        pledges = await pledge.get_by_issue_ids(session, [issue.id])
        if pledges:
            for p in pledges:
                if p.by_organization_id:
                    await self.send_to_org(
                        session=session,
                        org_id=p.by_organization_id,
                        notif=notif,
                    )

                    sent_to_orgs.add(p.by_organization_id)
                    continue

                if p.by_user_id:
                    await self.send_to_user(
                        session=session,
                        user_id=p.by_user_id,
                        notif=notif,
                    )
                    continue

                if p.email:
                    await self.send_to_anonymous_email(
                        session=session,
                        email_addr=p.email,
                        notif=notif,
                    )

    def parse_payload(
        self, n: Notification
    ) -> Union[
        MaintainerPledgeCreatedNotification,
        MaintainerPledgePendingNotification,
        MaintainerPledgePaidNotification,
        PledgerPledgePendingNotification,
    ]:
        match n.type:
            case "MaintainerPledgeCreatedNotification":
                return parse_obj_as(MaintainerPledgeCreatedNotification, n.payload)
            case "MaintainerPledgePendingNotification":
                return parse_obj_as(MaintainerPledgePendingNotification, n.payload)
            case "MaintainerPledgePaidNotification":
                return parse_obj_as(MaintainerPledgePaidNotification, n.payload)
            case "PledgerPledgePendingNotification":
                return parse_obj_as(PledgerPledgePendingNotification, n.payload)
        raise ValueError(f"unknown notificaiton type {n.type}")

    async def get_user_last_read(
        self, session: AsyncSession, user_id: UUID
    ) -> UUID | None:
        stmt = sql.select(UserNotification).where(UserNotification.user_id == user_id)
        res = await session.execute(stmt)
        user_notif = res.scalar_one_or_none()
        return user_notif.last_read_notification_id if user_notif else None

    async def set_user_last_read(
        self, session: AsyncSession, user_id: UUID, notification_id: UUID
    ) -> None:
        stmt = (
            sql.insert(UserNotification)
            .values(user_id=user_id, last_read_notification_id=notification_id)
            .on_conflict_do_update(
                index_elements=[UserNotification.user_id],
                set_={"last_read_notification_id": notification_id},
            )
        )
        await session.execute(stmt)
        await session.commit()


def get_cents_in_dollar_string(cents: int) -> str:
    dollars = cents / 100
    if cents % 100 == 0:
        return "%d" % round(dollars)
    return "%.2f" % round(dollars, 2)


notifications = NotificationsService()
