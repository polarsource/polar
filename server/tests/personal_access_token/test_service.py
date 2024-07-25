from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.enums import TokenType
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import PersonalAccessToken, User
from polar.personal_access_token.service import (
    personal_access_token as personal_access_token_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestRevokeLeaked:
    async def test_false_positive(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        email_sender_mock = MagicMock()
        mocker.patch(
            "polar.personal_access_token.service.get_email_sender",
            return_value=email_sender_mock,
        )

        result = await personal_access_token_service.revoke_leaked(
            session,
            "polar_pat_123",
            TokenType.personal_access_token,
            notifier="github",
            url="https://github.com",
        )
        assert result is False

        send_to_user_mock: MagicMock = email_sender_mock.send_to_user
        send_to_user_mock.assert_not_called()

    async def test_true_positive(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        email_sender_mock = MagicMock()
        mocker.patch(
            "polar.personal_access_token.service.get_email_sender",
            return_value=email_sender_mock,
        )

        token_hash = get_token_hash("polar_pat_123", secret=settings.SECRET)
        personal_access_token = PersonalAccessToken(
            comment="Test",
            token=token_hash,
            user_id=user.id,
            expires_at=utc_now() + timedelta(days=1),
            scope="openid",
        )
        await save_fixture(personal_access_token)

        result = await personal_access_token_service.revoke_leaked(
            session,
            "polar_pat_123",
            TokenType.personal_access_token,
            notifier="github",
            url="https://github.com",
        )
        assert result is True

        updated_personal_access_token = await session.get(
            PersonalAccessToken, personal_access_token.id
        )
        assert updated_personal_access_token is not None
        assert updated_personal_access_token.deleted_at is not None

        send_to_user_mock: MagicMock = email_sender_mock.send_to_user
        send_to_user_mock.assert_called_once()
