from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from httpx_oauth.oauth2 import OAuth2Token
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.exceptions import Unauthorized
from polar.integrations.github_repository_benefit.endpoints import (
    get_decoded_token_state,
)
from polar.integrations.github_repository_benefit.service import github_oauth_client
from polar.kit import jwt
from polar.kit.utils import utc_now
from polar.models import OAuthAccount, User
from polar.postgres import AsyncSession


@pytest.mark.anyio
class TestGetDecodedTokenState:
    async def test_expired_state_raises_unauthorized(self) -> None:
        expired_state = await jwt.encode(
            data={"return_to": "/"},
            type="github_repository_benefit_oauth",
            expires_at=utc_now() - timedelta(minutes=1),
        )
        token_data = OAuth2Token({"access_token": "ghu_test"})

        with pytest.raises(Unauthorized):
            await get_decoded_token_state((token_data, expired_state))


@pytest.mark.anyio
class TestUserCallback:
    @pytest.mark.auth
    async def test_access_token_missing_from_response_redirects_with_error(
        self,
        client: AsyncClient,
        session: AsyncSession,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        state = await jwt.encode(
            data={"return_to": "/dashboard"},
            type="github_repository_benefit_oauth",
        )
        mocker.patch.object(
            github_oauth_client,
            "get_access_token",
            new=AsyncMock(
                return_value={
                    "error": "bad_verification_code",
                    "error_description": "The code passed is incorrect or expired.",
                }
            ),
        )

        response = await client.get(
            "/v1/integrations/github_repository_benefit/user/callback",
            params={"state": state, "code": "invalid-code"},
            follow_redirects=False,
        )

        assert response.status_code == 303
        assert "error=Failed+to+get+access+token" in response.headers["location"]

        result = await session.execute(
            select(OAuthAccount).where(OAuthAccount.user_id == user.id)
        )
        assert result.scalars().all() == []
