from datetime import timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.auth.service import USER_SESSION_TOKEN_PREFIX
from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.db.postgres import Session
from polar.kit.utils import utc_now
from polar.models import (
    OAuth2Client,
    OAuth2Grant,
    Organization,
    User,
    UserOrganization,
    UserSession,
)
from polar.oauth2.service.oauth2_grant import oauth2_grant as oauth2_grant_service
from polar.oauth2.sub_type import SubType
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture

from ..conftest import create_oauth2_authorization_code, create_oauth2_token


@pytest_asyncio.fixture
async def oauth2_client(save_fixture: SaveFixture, user: User) -> OAuth2Client:
    oauth2_client = OAuth2Client(
        client_id="polar_ci_123",
        client_secret="polar_cs_123",
        registration_access_token="polar_crt_123",
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
            "default_sub_type": "organization",
        }
    )
    await save_fixture(oauth2_client)
    return oauth2_client


@pytest_asyncio.fixture
async def public_oauth2_client(save_fixture: SaveFixture, user: User) -> OAuth2Client:
    oauth2_client = OAuth2Client(
        client_id="polar_ci_123",
        client_secret="polar_cs_123",
        registration_access_token="polar_crt_123",
        user=user,
    )
    oauth2_client.set_client_metadata(
        {
            "client_name": "Test Client",
            "redirect_uris": ["http://127.0.0.1:8000/docs/oauth2-redirect"],
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "scope": "openid profile email",
            "default_sub_type": "organization",
        }
    )
    await save_fixture(oauth2_client)
    return oauth2_client


@pytest_asyncio.fixture
async def first_party_oauth2_client(
    save_fixture: SaveFixture, user: User
) -> OAuth2Client:
    oauth2_client = OAuth2Client(
        client_id="polar_ci_123",
        client_secret="polar_cs_123",
        registration_access_token="polar_crt_123",
        first_party=True,
        user=user,
    )
    oauth2_client.set_client_metadata(
        {
            "client_name": "Test Client",
            "redirect_uris": ["http://127.0.0.1:8000/docs/oauth2-redirect"],
            "token_endpoint_auth_method": "client_secret_post",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "scope": "openid profile email web:read web:write",
            "default_sub_type": "user",
        }
    )
    await save_fixture(oauth2_client)
    return oauth2_client


@pytest_asyncio.fixture
async def web_grant_oauth2_client(
    save_fixture: SaveFixture, user: User
) -> OAuth2Client:
    oauth2_client = OAuth2Client(
        client_id="polar_ci_123",
        client_secret="polar_cs_123",
        registration_access_token="polar_crt_123",
        user=user,
    )
    oauth2_client.set_client_metadata(
        {
            "client_name": "Test Client",
            "redirect_uris": ["http://127.0.0.1:8000/docs/oauth2-redirect"],
            "token_endpoint_auth_method": "client_secret_post",
            "grant_types": ["web"],
            "response_types": [],
            "scope": "openid profile email",
        }
    )
    await save_fixture(oauth2_client)
    return oauth2_client


async def create_oauth2_grant(
    save_fixture: SaveFixture,
    *,
    client: OAuth2Client,
    scopes: list[str],
    user: User | None = None,
    organization: Organization | None = None,
) -> OAuth2Grant:
    oauth2_grant = OAuth2Grant(
        client_id=client.client_id,
        user_id=user.id if user is not None else None,
        organization_id=organization.id if organization is not None else None,
        scope=" ".join(scopes),
    )
    await save_fixture(oauth2_grant)
    return oauth2_grant


@pytest.mark.asyncio
class TestOAuth2Register:
    @pytest.mark.parametrize("redirect_uri", ["http://example.com", "foobar"])
    @pytest.mark.auth
    async def test_invalid_redirect_uri(
        self, redirect_uri: str, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/v1/oauth2/register",
            json={"client_name": "Test Client", "redirect_uris": [redirect_uri]},
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user"),
    )
    @pytest.mark.parametrize(
        "redirect_uri",
        [
            "https://example.com",
            "http://localhost:8000/callback",
            "http://127.0.0.1:8000/callback",
        ],
    )
    async def test_valid(self, redirect_uri: str, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/oauth2/register",
            json={
                "client_name": "Test Client",
                "redirect_uris": [redirect_uri],
                "scope": "openid email",
            },
        )

        assert response.status_code == 201
        json = response.json()

        assert "registration_access_token" in json
        assert json["token_endpoint_auth_method"] == "client_secret_post"
        assert json["scope"] == "openid email"
        for value in json.values():
            assert value is not None

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_valid_public_client(self, client: AsyncClient) -> None:
        """Test that public clients (token_endpoint_auth_method='none') don't receive client_secret."""
        response = await client.post(
            "/v1/oauth2/register",
            json={
                "client_name": "Test Public Client",
                "redirect_uris": ["https://example.com/callback"],
                "token_endpoint_auth_method": "none",
                "scope": "openid email",
            },
        )

        assert response.status_code == 201
        json = response.json()

        # Verify the client was registered as public
        assert json["token_endpoint_auth_method"] == "none"

        # Temporary workaround: client_secret should NOT be in the response
        assert "client_secret" not in json
        assert "client_secret_expires_at" not in json

        # Other fields should still be present
        assert "client_id" in json
        assert "registration_access_token" in json
        assert json["scope"] == "openid email"


@pytest.mark.asyncio
class TestOAuth2ConfigureGet:
    async def test_unauthenticated(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.get(f"/v1/oauth2/register/{oauth2_client.client_id}")

        assert response.status_code == 400

    async def test_token_not_existing_client(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/oauth2/register/INVALID_CLIENT_ID",
            headers={"Authorization": "Bearer REGISTRATION_ACCESS_TOKEN"},
        )

        assert response.status_code == 401

    async def test_token_invalid_token(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.get(
            f"/v1/oauth2/register/{oauth2_client.client_id}",
            headers={"Authorization": "Bearer INVALID_REGISTRATION_ACCESS_TOKEN"},
        )

        assert response.status_code == 401

    async def test_token_valid(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.get(
            f"/v1/oauth2/register/{oauth2_client.client_id}",
            headers={
                "Authorization": f"Bearer {oauth2_client.registration_access_token}"
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["client_id"] == oauth2_client.client_id
        for value in json.values():
            assert value is not None

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_user_not_owner(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.get(f"/v1/oauth2/register/{oauth2_client.client_id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_valid(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.get(f"/v1/oauth2/register/{oauth2_client.client_id}")

        assert response.status_code == 200
        json = response.json()
        assert json["client_id"] == oauth2_client.client_id
        for value in json.values():
            assert value is not None

    async def test_public_client_no_secret(
        self, client: AsyncClient, public_oauth2_client: OAuth2Client
    ) -> None:
        """Test that public clients don't receive client_secret when retrieving config."""
        response = await client.get(
            f"/v1/oauth2/register/{public_oauth2_client.client_id}",
            headers={
                "Authorization": f"Bearer {public_oauth2_client.registration_access_token}"
            },
        )

        assert response.status_code == 200
        json = response.json()

        # Verify the client is public
        assert json["token_endpoint_auth_method"] == "none"

        # Temporary workaround: client_secret should NOT be in the response
        assert "client_secret" not in json
        assert "client_secret_expires_at" not in json

        # Other fields should still be present
        assert json["client_id"] == public_oauth2_client.client_id
        assert "registration_access_token" in json


@pytest.mark.asyncio
class TestOAuth2ConfigurePut:
    async def test_token_valid(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.put(
            f"/v1/oauth2/register/{oauth2_client.client_id}",
            headers={
                "Authorization": f"Bearer {oauth2_client.registration_access_token}"
            },
            json={
                "client_id": oauth2_client.client_id,
                "client_name": "Test Client Updated",
                "redirect_uris": ["https://example.com/callback"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["client_id"] == oauth2_client.client_id
        assert json["client_name"] == "Test Client Updated"
        assert json["redirect_uris"] == ["https://example.com/callback"]
        for value in json.values():
            assert value is not None

    @pytest.mark.auth
    async def test_user_valid(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.put(
            f"/v1/oauth2/register/{oauth2_client.client_id}",
            json={
                "client_id": oauth2_client.client_id,
                "client_name": "Test Client Updated",
                "redirect_uris": ["https://example.com/callback"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["client_id"] == oauth2_client.client_id
        assert json["client_name"] == "Test Client Updated"
        assert json["redirect_uris"] == ["https://example.com/callback"]
        for value in json.values():
            assert value is not None


@pytest.mark.asyncio
class TestOAuth2ConfigureDelete:
    async def test_token_valid(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.delete(
            f"/v1/oauth2/register/{oauth2_client.client_id}",
            headers={
                "Authorization": f"Bearer {oauth2_client.registration_access_token}"
            },
        )

        assert response.status_code == 204

    @pytest.mark.auth
    async def test_user_valid(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        response = await client.delete(f"/v1/oauth2/register/{oauth2_client.client_id}")

        assert response.status_code == 204


@pytest.mark.asyncio
class TestOAuth2Authorize:
    async def test_unauthenticated(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 401

    async def test_unauthenticated_prompt_none(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "prompt": "none",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=login_required" in location

    @pytest.mark.auth
    async def test_authenticated_invalid_sub_type(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "foo",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 400

    @pytest.mark.auth
    @pytest.mark.parametrize(
        ("input_sub_type", "expected_sub_type"),
        [("user", "user"), (None, "organization"), ("organization", "organization")],
    )
    async def test_authenticated(
        self,
        input_sub_type: str | None,
        expected_sub_type: str,
        client: AsyncClient,
        oauth2_client: OAuth2Client,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
        }
        if input_sub_type is not None:
            params["sub_type"] = input_sub_type
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 200

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert set(json["scopes"]) == {"openid", "profile", "email"}
        assert json["sub_type"] == expected_sub_type

    @pytest.mark.auth
    async def test_authenticated_prompt_login(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "prompt": "login",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_no_scope(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 200

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert set(json["scopes"]) == set(oauth2_client.scope.split(" "))

    @pytest.mark.auth
    @pytest.mark.parametrize("prompt", [None, "none", "consent"])
    async def test_no_scope_first_party_client(
        self,
        prompt: str | None,
        client: AsyncClient,
        first_party_oauth2_client: OAuth2Client,
    ) -> None:
        params = {
            "client_id": first_party_oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
        }
        if prompt is not None:
            params["prompt"] = prompt
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

    @pytest.mark.auth
    async def test_new_scope(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_grant(
            save_fixture,
            client=oauth2_client,
            user=user,
            scopes=["openid", "profile"],
        )
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 200

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert set(json["scopes"]) == {"openid", "profile", "email"}

    @pytest.mark.auth
    @pytest.mark.parametrize("prompt", [None, "none", "consent"])
    async def test_new_scope_first_party_client(
        self,
        prompt: str | None,
        sync_session: Session,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        first_party_oauth2_client: OAuth2Client,
    ) -> None:
        grant = await create_oauth2_grant(
            save_fixture,
            client=first_party_oauth2_client,
            user=user,
            scopes=["openid", "profile"],
        )
        params = {
            "client_id": first_party_oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
        }
        if prompt is not None:
            params["prompt"] = prompt
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

        updated_grant = sync_session.get(OAuth2Grant, grant.id)
        assert updated_grant is not None
        assert set(updated_grant.scopes) == set(
            first_party_oauth2_client.scope.split(" ")
        )

    @pytest.mark.auth
    @pytest.mark.parametrize("scope", ["openid", "openid profile email"])
    async def test_granted(
        self,
        scope: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_grant(
            save_fixture,
            client=oauth2_client,
            user=user,
            scopes=["openid", "profile", "email"],
        )
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": scope,
            "sub_type": "user",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

    @pytest.mark.auth
    async def test_granted_prompt_consent(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_grant(
            save_fixture,
            client=oauth2_client,
            user=user,
            scopes=["openid", "profile", "email"],
        )
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "prompt": "consent",
            "sub_type": "user",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert set(json["scopes"]) == {"openid", "profile", "email"}

    @pytest.mark.auth
    @pytest.mark.parametrize("granted_scope", [None, ["openid", "profile"]])
    async def test_not_granted_prompt_none(
        self,
        save_fixture: SaveFixture,
        granted_scope: list[str],
        client: AsyncClient,
        oauth2_client: OAuth2Client,
    ) -> None:
        if granted_scope is not None:
            await create_oauth2_grant(
                save_fixture,
                client=oauth2_client,
                user=oauth2_client.user,
                scopes=granted_scope,
            )

        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "prompt": "none",
            "sub_type": "user",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=consent_required" in location

    @pytest.mark.auth
    @pytest.mark.parametrize("scope", ["openid", "openid profile email"])
    async def test_granted_organization(
        self,
        scope: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_grant(
            save_fixture,
            client=oauth2_client,
            organization=organization,
            scopes=["openid", "profile", "email"],
        )
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": scope,
            "sub_type": "organization",
            "sub": str(organization.id),
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

    @pytest.mark.auth
    async def test_granted_organization_prompt_consent(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_grant(
            save_fixture,
            client=oauth2_client,
            organization=organization,
            scopes=["openid", "profile", "email"],
        )
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "organization",
            "sub": str(organization.id),
            "prompt": "consent",
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert set(json["scopes"]) == {"openid", "profile", "email"}

    @pytest.mark.auth
    async def test_not_granted_organization_prompt_none(
        self,
        client: AsyncClient,
        oauth2_client: OAuth2Client,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "prompt": "none",
            "sub_type": "organization",
            "sub": str(organization.id),
        }
        response = await client.get("/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=consent_required" in location


@pytest.mark.asyncio
class TestOAuth2Consent:
    async def test_unauthenticated(self, client: AsyncClient) -> None:
        response = await client.post("/v1/oauth2/consent")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_deny(self, client: AsyncClient, oauth2_client: OAuth2Client) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "user",
        }
        response = await client.post(
            "/v1/oauth2/consent", params=params, data={"action": "deny"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=access_denied" in location

    @pytest.mark.auth
    async def test_allow(
        self,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
        sync_session: Session,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "user",
        }
        response = await client.post(
            "/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

        grant = oauth2_grant_service._get_by_sub_and_client_id(
            sync_session,
            sub_type=SubType.user,
            sub_id=user.id,
            client_id=oauth2_client.client_id,
        )
        assert grant is not None
        assert grant.scopes == ["openid", "profile", "email"]

    @pytest.mark.auth
    async def test_organization_missing_sub(
        self,
        client: AsyncClient,
        user: User,
        organization: Organization,
        oauth2_client: OAuth2Client,
        sync_session: Session,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "organization",
        }
        response = await client.post(
            "/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 400
        json = response.json()
        assert json["error"] == "invalid_sub"

    @pytest.mark.auth
    async def test_organization_not_member(
        self,
        client: AsyncClient,
        user: User,
        organization: Organization,
        oauth2_client: OAuth2Client,
        sync_session: Session,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "organization",
            "sub": str(organization.id),
        }
        response = await client.post(
            "/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 400
        json = response.json()
        assert json["error"] == "invalid_sub"

    @pytest.mark.auth
    async def test_organization_deny(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        oauth2_client: OAuth2Client,
        sync_session: Session,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "organization",
            "sub": str(organization.id),
        }
        response = await client.post(
            "/v1/oauth2/consent", params=params, data={"action": "deny"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=access_denied" in location

    @pytest.mark.auth
    async def test_organization_allow(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        oauth2_client: OAuth2Client,
        sync_session: Session,
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "sub_type": "organization",
            "sub": str(organization.id),
        }
        response = await client.post(
            "/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

        grant = oauth2_grant_service._get_by_sub_and_client_id(
            sync_session,
            sub_type=SubType.organization,
            sub_id=organization.id,
            client_id=oauth2_client.client_id,
        )
        assert grant is not None
        assert grant.scopes == ["openid", "profile", "email"]


@pytest.mark.asyncio
class TestOAuth2Token:
    async def test_authorization_code_sub_user(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_authorization_code(
            save_fixture,
            client=oauth2_client,
            code="CODE",
            scopes=["openid", "profile", "email"],
            redirect_uri="http://127.0.0.1:8000/docs/oauth2-redirect",
            user=user,
        )

        data = {
            "grant_type": "authorization_code",
            "code": "CODE",
            "client_id": oauth2_client.client_id,
            "client_secret": oauth2_client.client_secret,
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_u_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_u_")

    async def test_authorization_code_public_client(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        public_oauth2_client: OAuth2Client,
    ) -> None:
        code_verifier = "A" * 43
        await create_oauth2_authorization_code(
            save_fixture,
            client=public_oauth2_client,
            code="CODE",
            scopes=["openid", "profile", "email"],
            redirect_uri="http://127.0.0.1:8000/docs/oauth2-redirect",
            user=user,
            code_verifier=code_verifier,
            code_challenge_method="S256",
        )

        data = {
            "grant_type": "authorization_code",
            "code": "CODE",
            "client_id": public_oauth2_client.client_id,
            "code_verifier": code_verifier,
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_u_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_u_")

    async def test_authorization_code_sub_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_authorization_code(
            save_fixture,
            client=oauth2_client,
            code="CODE",
            scopes=["openid", "profile", "email"],
            redirect_uri="http://127.0.0.1:8000/docs/oauth2-redirect",
            organization=organization,
        )

        data = {
            "grant_type": "authorization_code",
            "code": "CODE",
            "client_id": oauth2_client.client_id,
            "client_secret": oauth2_client.client_secret,
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_o_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_o_")

    async def test_refresh_token_sub_user(
        self,
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
            scopes=["openid", "profile", "email"],
            user=user,
        )

        data = {
            "grant_type": "refresh_token",
            "refresh_token": "REFRESH_TOKEN",
            "client_id": oauth2_client.client_id,
            "client_secret": oauth2_client.client_secret,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_u_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_u_")

    async def test_refresh_token_sub_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=oauth2_client,
            access_token="ACCESS_TOKEN",
            refresh_token="REFRESH_TOKEN",
            scopes=["openid", "profile", "email"],
            organization=organization,
        )

        data = {
            "grant_type": "refresh_token",
            "refresh_token": "REFRESH_TOKEN",
            "client_id": oauth2_client.client_id,
            "client_secret": oauth2_client.client_secret,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_o_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_o_")

    async def test_refresh_token_unauthenticated_private_client(
        self,
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
            scopes=["openid", "profile", "email"],
            user=user,
        )

        data = {
            "grant_type": "refresh_token",
            "refresh_token": "REFRESH_TOKEN",
            "client_id": oauth2_client.client_id,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 401

    async def test_refresh_token_public_client(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        public_oauth2_client: OAuth2Client,
    ) -> None:
        await create_oauth2_token(
            save_fixture,
            client=public_oauth2_client,
            access_token="ACCESS_TOKEN",
            refresh_token="REFRESH_TOKEN",
            scopes=["openid", "profile", "email"],
            user=user,
        )

        data = {
            "grant_type": "refresh_token",
            "refresh_token": "REFRESH_TOKEN",
            "client_id": public_oauth2_client.client_id,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_u_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_u_")

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({"grant_type": "web"}, id="missing session_token"),
            pytest.param(
                {
                    "grant_type": "web",
                    "session_token": "TOKEN",
                    "sub_type": "invalid",
                },
                id="invalid sub_type",
            ),
            pytest.param(
                {
                    "grant_type": "web",
                    "session_token": "TOKEN",
                    "sub_type": "user",
                    "sub": "USER_ID",
                },
                id="sub set for user sub_type",
            ),
            pytest.param(
                {
                    "grant_type": "web",
                    "session_token": "TOKEN",
                    "sub_type": "organization",
                },
                id="missing sub for organization sub_type",
            ),
            pytest.param(
                {
                    "grant_type": "web",
                    "session_token": "TOKEN",
                    "sub_type": "organization",
                    "sub": "ORGANIZATION_ID",
                },
                id="invalid uuid sub for organization sub_type",
            ),
            pytest.param(
                {
                    "grant_type": "web",
                    "session_token": "TOKEN",
                    "sub_type": "user",
                    "scope": "invalid_scope",
                },
                id="invalid scope",
            ),
        ],
    )
    async def test_web_grant_invalid_request(
        self,
        payload: dict[str, str],
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        web_grant_oauth2_client: OAuth2Client,
    ) -> None:
        data = {
            **payload,
            "client_id": web_grant_oauth2_client.client_id,
            "client_secret": web_grant_oauth2_client.client_secret,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 400

    async def test_web_grant_not_allowed_client(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        oauth2_client: OAuth2Client,
    ) -> None:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=USER_SESSION_TOKEN_PREFIX
        )
        user_session = UserSession(
            token=token_hash,
            user_agent="tests",
            user=user,
            scopes={Scope.web_write},
            expires_at=utc_now() + timedelta(seconds=60),
        )
        await save_fixture(user_session)

        data = {
            "grant_type": "web",
            "session_token": token,
            "client_id": oauth2_client.client_id,
            "client_secret": oauth2_client.client_secret,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 400

    async def test_web_grant_sub_organization_not_member(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        organization: Organization,
        web_grant_oauth2_client: OAuth2Client,
    ) -> None:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=USER_SESSION_TOKEN_PREFIX
        )
        user_session = UserSession(
            token=token_hash,
            user_agent="tests",
            user=user,
            scopes={Scope.web_write},
            expires_at=utc_now() + timedelta(seconds=60),
        )
        await save_fixture(user_session)

        data = {
            "grant_type": "web",
            "session_token": token,
            "client_id": web_grant_oauth2_client.client_id,
            "client_secret": web_grant_oauth2_client.client_secret,
            "sub_type": "organization",
            "sub": str(organization.id),
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 400

    async def test_web_grant_sub_user(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        web_grant_oauth2_client: OAuth2Client,
    ) -> None:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=USER_SESSION_TOKEN_PREFIX
        )
        user_session = UserSession(
            token=token_hash,
            user_agent="tests",
            user=user,
            scopes={Scope.web_write},
            expires_at=utc_now() + timedelta(seconds=60),
        )
        await save_fixture(user_session)

        data = {
            "grant_type": "web",
            "session_token": token,
            "client_id": web_grant_oauth2_client.client_id,
            "client_secret": web_grant_oauth2_client.client_secret,
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_u_")
        assert "refresh_token" not in json

    async def test_web_grant_sub_organization(
        self,
        save_fixture: SaveFixture,
        sync_session: Session,
        client: AsyncClient,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
        web_grant_oauth2_client: OAuth2Client,
    ) -> None:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=USER_SESSION_TOKEN_PREFIX
        )
        user_session = UserSession(
            token=token_hash,
            user_agent="tests",
            user=user,
            scopes={Scope.web_write},
            expires_at=utc_now() + timedelta(seconds=60),
        )
        await save_fixture(user_session)

        data = {
            "grant_type": "web",
            "session_token": token,
            "client_id": web_grant_oauth2_client.client_id,
            "client_secret": web_grant_oauth2_client.client_secret,
            "sub_type": "organization",
            "sub": str(organization.id),
        }

        response = await client.post("/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_o_")
        assert "refresh_token" not in json
