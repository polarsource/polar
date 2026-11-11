from datetime import timedelta

import pytest
from httpx_oauth.oauth2 import OAuth2Token

from polar.exceptions import Unauthorized
from polar.integrations.github_repository_benefit.endpoints import (
    get_decoded_token_state,
)
from polar.kit import jwt
from polar.kit.utils import utc_now


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
