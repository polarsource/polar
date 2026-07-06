import pytest

from polar.auth.models import AuthSubject
from polar.models.notification_recipient import NotificationRecipient
from polar.models.user import User
from polar.notification_recipient.repository import NotificationRecipientRepository
from polar.notification_recipient.schemas import (
    NotificationRecipientCreate,
    NotificationRecipientPlatform,
)
from polar.notification_recipient.service import (
    notification_recipient as notification_recipient_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_notification_recipient


@pytest.mark.asyncio
class TestCreate:
    async def test_conflicting_row_returns_existing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        # Simulates the concurrent-registration race: a live row already exists
        # for this (user, token) when create_race_safe runs its INSERT. It must
        # resolve to the existing row instead of raising IntegrityError.
        existing = await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="token",
            platform=NotificationRecipientPlatform.ios,
        )

        repository = NotificationRecipientRepository.from_session(session)
        result = await repository.create_race_safe(
            NotificationRecipient(
                user_id=user.id,
                platform=NotificationRecipientPlatform.ios,
                expo_push_token="token",
            )
        )

        assert result.id == existing.id

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_reassign_from_other_user_soft_deletes_previous(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        user_second: User,
    ) -> None:
        previous = await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="shared",
            platform=NotificationRecipientPlatform.ios,
        )

        result = await notification_recipient_service.create(
            session,
            NotificationRecipientCreate(
                platform=NotificationRecipientPlatform.ios,
                expo_push_token="shared",
            ),
            auth_subject,
        )

        assert result.user_id == user_second.id
        assert result.id != previous.id
        assert previous.deleted_at is not None
