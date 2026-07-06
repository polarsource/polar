from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.models.notification_recipient import NotificationRecipient
from polar.models.user import User
from polar.postgres import AsyncSession

from .repository import NotificationRecipientRepository
from .schemas import (
    NotificationRecipientCreate,
    NotificationRecipientPlatform,
)


class NotificationRecipientService:
    async def list_by_user(
        self,
        session: AsyncSession,
        user_id: UUID,
        expo_push_token: str | None,
        platform: NotificationRecipientPlatform | None,
    ) -> Sequence[NotificationRecipient]:
        repository = NotificationRecipientRepository.from_session(session)
        return await repository.list_by_user(
            user_id, expo_push_token=expo_push_token, platform=platform
        )

    async def create(
        self,
        session: AsyncSession,
        notification_recipient_create: NotificationRecipientCreate,
        auth_subject: AuthSubject[User],
    ) -> NotificationRecipient:
        repository = NotificationRecipientRepository.from_session(session)
        user_id = auth_subject.subject.id
        expo_push_token = notification_recipient_create.expo_push_token

        # Same device previously registered under other accounts: remove those
        # registrations so the old users stop receiving this device's pushes.
        others = await repository.list_by_expo_token_excluding_user(
            expo_push_token, user_id
        )
        for recipient in others:
            await repository.soft_delete(recipient)

        return await repository.create_race_safe(
            NotificationRecipient(
                user_id=user_id,
                platform=notification_recipient_create.platform,
                expo_push_token=expo_push_token,
            )
        )

    async def delete(
        self, session: AsyncSession, auth_subject: AuthSubject[User], id: UUID
    ) -> None:
        repository = NotificationRecipientRepository.from_session(session)
        await repository.delete(id, auth_subject.subject.id)


notification_recipient = NotificationRecipientService()
