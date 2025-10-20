from collections.abc import Sequence
from uuid import UUID

from pydantic import BaseModel, TypeAdapter
from sqlalchemy import desc
from sqlalchemy.orm import joinedload

from polar.kit.extensions.sqlalchemy import sql
from polar.models.notification import Notification
from polar.models.user_notification import UserNotification
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .notification import Notification as NotificationSchema
from .notification import NotificationPayload, NotificationType


class PartialNotification(BaseModel):
    type: NotificationType
    payload: NotificationPayload


class NotificationsService:
    async def get(self, session: AsyncSession, id: UUID) -> Notification | None:
        stmt = (
            sql.select(Notification)
            .where(Notification.id == id)
            .options(joinedload(Notification.user))
        )

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def get_for_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Notification]:
        stmt = (
            sql.select(Notification)
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
            payload=notif.payload.model_dump(mode="json"),
        )

        session.add(notification)
        await session.flush()
        enqueue_job("notifications.send", notification_id=notification.id)
        enqueue_job("notifications.push", notification_id=notification.id)
        return True

    async def send_to_org_members(
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

    def parse_payload(self, n: Notification) -> NotificationPayload:
        NotificationTypeAdapter: TypeAdapter[NotificationSchema] = TypeAdapter(
            NotificationSchema
        )
        notification = NotificationTypeAdapter.validate_python(n)
        return notification.payload

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


notifications = NotificationsService()
