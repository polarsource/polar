from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.repository.base import Options
from polar.models.notification_recipient import NotificationRecipient

from .schemas import NotificationRecipientPlatform


class NotificationRecipientRepository(
    RepositorySoftDeletionIDMixin[NotificationRecipient, UUID],
    RepositorySoftDeletionMixin[NotificationRecipient],
    RepositoryBase[NotificationRecipient],
):
    model = NotificationRecipient

    async def delete(
        self, notification_recipient_id: UUID, user_id: UUID, *, flush: bool = False
    ) -> None:
        # First get the notification recipient
        statement = (
            self.get_base_statement()
            .where(NotificationRecipient.id == notification_recipient_id)
            .where(NotificationRecipient.user_id == user_id)
        )
        notification_recipient = await self.get_one_or_none(statement)

        # If notification recipient exists, soft delete it
        if notification_recipient:
            await self.soft_delete(notification_recipient, flush=flush)

        return None

    async def list_by_user(
        self,
        user_id: UUID,
        platform: NotificationRecipientPlatform | None,
        expo_push_token: str | None,
        *,
        options: Options = (),
    ) -> Sequence[NotificationRecipient]:
        statement = self.get_base_statement().where(
            NotificationRecipient.user_id == user_id
        )

        if expo_push_token:
            statement = statement.where(
                NotificationRecipient.expo_push_token == expo_push_token
            )

        if platform:
            statement = statement.where(NotificationRecipient.platform == platform)

        return await self.get_all(statement.options(*options))

    async def get_by_user_and_expo_token(
        self, user_id: UUID, expo_push_token: str
    ) -> NotificationRecipient | None:
        statement = self.get_base_statement().where(
            NotificationRecipient.user_id == user_id,
            NotificationRecipient.expo_push_token == expo_push_token,
        )
        return await self.get_one_or_none(statement)

    async def list_by_expo_token_excluding_user(
        self, expo_push_token: str, user_id: UUID
    ) -> Sequence[NotificationRecipient]:
        statement = self.get_base_statement().where(
            NotificationRecipient.expo_push_token == expo_push_token,
            NotificationRecipient.user_id != user_id,
        )
        return await self.get_all(statement)

    async def create_race_safe(
        self, object: NotificationRecipient
    ) -> NotificationRecipient:
        # Atomic insert that closes the TOCTOU race between the existence check
        # and the INSERT when the same device registers concurrently. On
        # conflict with the live (user_id, expo_push_token) row, keep the
        # existing registration and return it instead of raising IntegrityError.
        statement = (
            pg_insert(NotificationRecipient)
            .values(
                user_id=object.user_id,
                platform=object.platform,
                expo_push_token=object.expo_push_token,
            )
            .on_conflict_do_nothing(
                index_elements=["user_id", "expo_push_token", "deleted_at"]
            )
            .returning(NotificationRecipient)
        )
        result = await self.session.execute(statement)
        inserted = result.scalars().first()
        if inserted is not None:
            return inserted

        existing = await self.get_by_user_and_expo_token(
            object.user_id, object.expo_push_token
        )
        assert existing is not None, (
            "notification_recipients row missing after on_conflict_do_nothing conflict"
        )
        return existing
