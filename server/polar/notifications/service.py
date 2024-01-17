from collections.abc import Sequence
from uuid import UUID

import structlog
from pydantic import BaseModel, TypeAdapter
from sqlalchemy import desc

from polar.kit.extensions.sqlalchemy import sql
from polar.models.issue import Issue
from polar.models.notification import Notification
from polar.models.pledge import Pledge
from polar.models.pull_request import PullRequest
from polar.models.user_notification import UserNotification
from polar.notifications.notification import Notification as NotificationSchema
from polar.notifications.notification import NotificationPayload, NotificationType
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
    type: NotificationType
    payload: NotificationPayload


class NotificationsService:
    async def get(self, session: AsyncSession, id: UUID) -> Notification | None:
        stmt = sql.select(Notification).where(Notification.id == id)

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

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
        notification = Notification(
            user_id=user_id,
            type=notif.type,
            issue_id=notif.issue_id,
            pledge_id=notif.pledge_id,
            pull_request_id=notif.pull_request_id,
            payload=notif.payload.model_dump(mode="json"),
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
        notification = Notification(
            email_addr=email_addr,
            type=notif.type,
            issue_id=notif.issue_id,
            pledge_id=notif.pledge_id,
            pull_request_id=notif.pull_request_id,
            payload=notif.payload.model_dump(mode="json"),
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

    def parse_payload(self, n: Notification) -> NotificationPayload:
        NotificationTypeAdapter = TypeAdapter(NotificationSchema)
        notification = NotificationTypeAdapter.validate_python(n)
        return notification.payload  # type: ignore

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


notifications = NotificationsService()
