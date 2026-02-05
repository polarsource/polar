import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import OAuth2Client, User
from tests.fixtures.database import SaveFixture

from ...conftest import create_oauth2_token


@pytest_asyncio.fixture
async def oauth2_client(save_fixture: SaveFixture, user: User) -> OAuth2Client:
    oauth2_client = OAuth2Client(
        client_id="spaire_ci_123",
        client_secret="spaire_cs_123",
        registration_access_token="spaire_crt_123",
        user=user,
    )
    oauth2_client.set_client_metadata(
        {
            "client_name": "Test Client",
            "redirect_uris": ["http://127.0.0.1:8000/docs/oauth2-redirect"],
            "token_endpoint_auth_method": "client_secret_post",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "scope": "openid profile email",
        }
    )
    await save_fixture(oauth2_client)
    return oauth2_client


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["GET", "POST"])
class TestOAuth2UserInfo:
    async def test_no_scope(
        self,
        method: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="ACCESS_TOKEN",
            refresh_token="REFRESH_TOKEN",
            scopes=[],
            user=user,
        )

        response = await client.request(
            method,
            "/v1/oauth2/userinfo",
            headers={"Authorization": "Bearer ACCESS_TOKEN"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["sub"] == str(user.id)
