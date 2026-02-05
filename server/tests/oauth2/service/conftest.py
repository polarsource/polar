import pytest
import pytest_asyncio

from polar.kit.db.postgres import AsyncSession
from polar.models import OAuth2Client, User
from tests.fixtures.database import SaveFixture, save_fixture_factory


@pytest.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    return save_fixture_factory(session)


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
