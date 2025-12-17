from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import TokenType
from polar.models import OAuth2Client
from polar.oauth2.service.oauth2_client import oauth2_client as oauth2_client_service
from polar.postgres import AsyncSession


@pytest.fixture(autouse=True)
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.oauth2.service.oauth2_client.enqueue_email", autospec=True
    )


@pytest.mark.asyncio
class TestRevokeLeaked:
    @pytest.mark.parametrize(
        ("token", "token_type"),
        [
            ("polar_cs_123", TokenType.client_secret),
            ("polar_crt_123", TokenType.client_registration_token),
        ],
    )
    async def test_false_positive(
        self,
        token: str,
        token_type: TokenType,
        session: AsyncSession,
        enqueue_email_mock: MagicMock,
    ) -> None:
        result = await oauth2_client_service.revoke_leaked(
            session, token, token_type, notifier="github", url="https://github.com"
        )
        assert result is False

        enqueue_email_mock.assert_not_called()

    @pytest.mark.parametrize(
        "token_type",
        [
            TokenType.client_secret,
            TokenType.client_registration_token,
        ],
    )
    async def test_true_positive(
        self,
        token_type: TokenType,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        enqueue_email_mock: MagicMock,
    ) -> None:
        token = (
            oauth2_client.client_secret
            if token_type == TokenType.client_secret
            else oauth2_client.registration_access_token
        )

        result = await oauth2_client_service.revoke_leaked(
            session, token, token_type, notifier="github", url="https://github.com"
        )
        assert result is True

        updated_oauth2_client = await session.get(OAuth2Client, oauth2_client.id)
        assert updated_oauth2_client is not None

        if token_type == TokenType.client_secret:
            assert updated_oauth2_client.client_secret != token
        else:
            assert updated_oauth2_client.registration_access_token != token

        enqueue_email_mock.assert_called_once()
