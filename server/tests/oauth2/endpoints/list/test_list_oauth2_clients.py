import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.kit.db.postgres import AsyncSession
from polar.models import OAuth2Client, User
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


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
class TestListOAuth2Clients:
    async def test_unauthenticated(self, client: AsyncClient) -> None:
        response = await client.get("/v1/oauth2/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_authenticated(
        self, session: AsyncSession, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        session.add(oauth2_client)
        await session.flush()

        response = await client.get("/v1/oauth2/")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["client_id"] == oauth2_client.client_id

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_user_not_owner(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.get("/v1/oauth2/")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0

    @pytest.mark.auth
    async def test_non_default_metadata(
        self, client: AsyncClient, session: AsyncSession, user: User
    ) -> None:
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
                "token_endpoint_auth_method": "client_secret_basic",
                "grant_types": ["authorization_code"],
                "response_types": ["code"],
                "scope": "openid profile email",
            }
        )
        session.add(oauth2_client)
        await session.flush()

        response = await client.get("/v1/oauth2/")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["client_id"] == oauth2_client.client_id

    @pytest.mark.auth
    async def test_deleted(
        self, client: AsyncClient, session: AsyncSession, oauth2_client: OAuth2Client
    ) -> None:
        oauth2_client.set_deleted_at()
        session.add(oauth2_client)
        await session.flush()

        response = await client.get("/v1/oauth2/")

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 0
