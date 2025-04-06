from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError, ValidationError
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

        errors: list[ValidationError] = []

        if await repository.get_by_expo_token(
            notification_recipient_create.expo_push_token
        ):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "expo_push_token"),
                    "msg": "A notification recipient with this Expo push token already exists.",
                    "input": notification_recipient_create.expo_push_token,
                }
            )

        if errors:
            raise PolarRequestValidationError(errors)

        return await repository.create(
            NotificationRecipient(
                user_id=auth_subject.subject.id,
                platform=notification_recipient_create.platform,
                expo_push_token=notification_recipient_create.expo_push_token,
            ),
            flush=True,
        )

    async def delete(
        self, session: AsyncSession, auth_subject: AuthSubject[User], id: UUID
    ) -> None:
        repository = NotificationRecipientRepository.from_session(session)
        await repository.delete(id, auth_subject.subject.id)


notification_recipient = NotificationRecipientService()
