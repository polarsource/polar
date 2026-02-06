import pytest

from polar.enums import TokenType
from polar.models import OAuth2AuthorizationCode, OAuth2Client, User
from polar.oauth2.service.oauth2_authorization_code import (
    oauth2_authorization_code as oauth2_authorization_code_service,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

from ..conftest import create_oauth2_authorization_code


@pytest.mark.asyncio
class TestRevokeLeaked:
    async def test_false_positive(self, session: AsyncSession) -> None:
        result = await oauth2_authorization_code_service.revoke_leaked(
            session,
            "spaire_ac_123",
            TokenType.authorization_code,
            notifier="github",
            url="https://github.com",
        )
        assert result is False

    async def test_true_positive(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        oauth2_client: OAuth2Client,
        user: User,
    ) -> None:
        authorization_code = await create_oauth2_authorization_code(
            save_fixture,
            client=oauth2_client,
            code="spaire_ac_123",
            scopes=["read"],
            redirect_uri="http://127.0.0.1:8000/docs/oauth2-redirect",
            user=user,
        )

        result = await oauth2_authorization_code_service.revoke_leaked(
            session,
            "spaire_ac_123",
            TokenType.authorization_code,
            notifier="github",
            url="https://github.com",
        )
        assert result is True

        updated_authorization_code = await session.get(
            OAuth2AuthorizationCode, authorization_code.id
        )
        assert updated_authorization_code is not None
        assert updated_authorization_code.deleted_at is not None
