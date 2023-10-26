from collections.abc import Sequence
from uuid import UUID

import structlog
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, parse_obj_as
from sqlalchemy import desc

from polar.kit.extensions.sqlalchemy import sql
from polar.models.issue import Issue
from polar.models.notification import Notification
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.user_notification import UserNotification
from polar.notifications.notification import (
    MaintainerPledgeConfirmationPendingNotification,
    MaintainerPledgeCreatedNotification,
    MaintainerPledgedIssueConfirmationPendingNotification,
    MaintainerPledgedIssuePendingNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    NotificationBase,
    PledgerPledgePendingNotification,
    RewardPaidNotification,
    TeamAdminMemberPledgedNotification,
)
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

log = structlog.get_logger()


class PartialNotification(BaseModel):
    issue_id: UUID | None = None
    pledge_id: UUID | None = None
    pull_request_id: UUID | None = None
    issue_reference_id: UUID | None = None
    payload: NotificationBase


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

    async def send_to_org_admins(
        self,
        session: AsyncSession,
        org_id: UUID,
        notif: PartialNotification,
    ) -> None:
        members = await user_organization_service.list_by_org(
            session,
            org_id,
            is_admin=True,
        )
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

    async def send_to_pledger(
        self,
        session: AsyncSession,
        pledge: Pledge,
        notif: PartialNotification,
    ) -> None:
        if pledge.by_organization_id:
            await self.send_to_org_admins(
                session=session,
                org_id=pledge.by_organization_id,
                notif=notif,
            )
            return

        if pledge.by_user_id:
            await self.send_to_user(
                session=session,
                user_id=pledge.by_user_id,
                notif=notif,
            )
            return

        if pledge.email:
            await self.send_to_anonymous_email(
                session=session,
                email_addr=pledge.email,
                notif=notif,
            )
            return

    def parse_payload(
        self, n: Notification
    ) -> (
        MaintainerPledgeCreatedNotification
        | MaintainerPledgeConfirmationPendingNotification
        | MaintainerPledgePendingNotification
        | MaintainerPledgePaidNotification
        | PledgerPledgePendingNotification
        | RewardPaidNotification
        | MaintainerPledgedIssueConfirmationPendingNotification
        | MaintainerPledgedIssuePendingNotification
        | TeamAdminMemberPledgedNotification
    ):
        match n.type:
            case "MaintainerPledgeCreatedNotification":
                return parse_obj_as(MaintainerPledgeCreatedNotification, n.payload)
            case "MaintainerPledgeConfirmationPendingNotification":
                return parse_obj_as(
                    MaintainerPledgeConfirmationPendingNotification, n.payload
                )
            case "MaintainerPledgePendingNotification":
                return parse_obj_as(MaintainerPledgePendingNotification, n.payload)
            case "MaintainerPledgePaidNotification":
                return parse_obj_as(MaintainerPledgePaidNotification, n.payload)
            case "PledgerPledgePendingNotification":
                return parse_obj_as(PledgerPledgePendingNotification, n.payload)
            case "RewardPaidNotification":
                return parse_obj_as(RewardPaidNotification, n.payload)
            case "MaintainerPledgedIssueConfirmationPendingNotification":
                return parse_obj_as(
                    MaintainerPledgedIssueConfirmationPendingNotification, n.payload
                )
            case "MaintainerPledgedIssuePendingNotification":
                return parse_obj_as(
                    MaintainerPledgedIssuePendingNotification, n.payload
                )
            case "TeamAdminMemberPledgedNotification":
                return parse_obj_as(TeamAdminMemberPledgedNotification, n.payload)

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
