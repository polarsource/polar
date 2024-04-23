from typing import cast

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import Session
from polar.models import (
    OAuth2AuthorizationCode,
    OAuth2Client,
    OAuth2Grant,
    OAuth2Token,
    Organization,
    User,
    UserOrganization,
)
from polar.oauth2.service.oauth2_grant import oauth2_grant as oauth2_grant_service
from polar.oauth2.sub_type import SubType
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def oauth2_client(save_fixture: SaveFixture) -> OAuth2Client:
    oauth2_client = OAuth2Client(
        client_id="polar_ci_123",
        client_secret="polar_cs_123",
    )
    oauth2_client.set_client_metadata(
        {
            "redirect_uris": ["http://127.0.0.1:8000/docs/oauth2-redirect"],
            "token_endpoint_auth_method": "client_secret_post",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
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


async def create_oauth2_authorization_code(
    save_fixture: SaveFixture,
    *,
    client: OAuth2Client,
    code: str,
    scopes: list[str],
    redirect_uri: str,
    user: User | None = None,
    organization: Organization | None = None,
) -> OAuth2AuthorizationCode:
    authorization_code = OAuth2AuthorizationCode(
        code=get_token_hash(code, secret=settings.SECRET),
        client_id=client.client_id,
        scope=" ".join(scopes),
        redirect_uri=redirect_uri,
    )
    if user is not None:
        authorization_code.user_id = user.id
        authorization_code.sub_type = SubType.user
    if organization is not None:
        authorization_code.organization_id = organization.id
        authorization_code.sub_type = SubType.organization
    await save_fixture(authorization_code)
    return authorization_code


async def create_oauth2_token(
    save_fixture: SaveFixture,
    *,
    client: OAuth2Client,
    access_token: str,
    refresh_token: str,
    scopes: list[str],
    user: User | None = None,
    organization: Organization | None = None,
) -> OAuth2Token:
    token = OAuth2Token(
        client_id=client.client_id,
        token_type="bearer",
        access_token=get_token_hash(access_token, secret=settings.SECRET),
        refresh_token=get_token_hash(refresh_token, secret=settings.SECRET),
        scope=" ".join(scopes),
    )
    if user is not None:
        token.user_id = user.id
        token.sub_type = SubType.user
    if organization is not None:
        token.organization_id = organization.id
        token.sub_type = SubType.organization
    await save_fixture(token)
    return token


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=login_required" in location

    @pytest.mark.override_current_user
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 400

    @pytest.mark.override_current_user
    @pytest.mark.parametrize(
        "input_sub_type,expected_sub_type",
        [("user", "user"), (None, "user"), ("organization", "organization")],
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 200

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert json["scopes"] == ["openid", "profile", "email"]
        assert json["sub_type"] == expected_sub_type

    @pytest.mark.override_current_user
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 401

    @pytest.mark.override_current_user
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
        }
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

    @pytest.mark.override_current_user
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
        }
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert json["scopes"] == ["openid", "profile", "email"]

    @pytest.mark.override_current_user
    async def test_not_granted_prompt_none(
        self, client: AsyncClient, oauth2_client: OAuth2Client
    ) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
            "prompt": "none",
        }
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=consent_required" in location

    @pytest.mark.override_current_user
    @pytest.mark.parametrize("scope", ["openid", "openid profile email"])
    async def test_granted_organization(
        self,
        scope: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

    @pytest.mark.override_current_user
    async def test_granted_organization_prompt_consent(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        json = response.json()
        assert json["client"]["client_id"] == oauth2_client.client_id
        assert json["scopes"] == ["openid", "profile", "email"]

    @pytest.mark.override_current_user
    async def test_not_granted_organization_prompt_none(
        self,
        client: AsyncClient,
        oauth2_client: OAuth2Client,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
        response = await client.get("/api/v1/oauth2/authorize", params=params)

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=consent_required" in location


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestOAuth2Consent:
    async def test_unauthenticated(self, client: AsyncClient) -> None:
        response = await client.post("/api/v1/oauth2/consent")

        assert response.status_code == 401

    @pytest.mark.override_current_user
    async def test_deny(self, client: AsyncClient, oauth2_client: OAuth2Client) -> None:
        params = {
            "client_id": oauth2_client.client_id,
            "response_type": "code",
            "redirect_uri": "http://127.0.0.1:8000/docs/oauth2-redirect",
            "scope": "openid profile email",
        }
        response = await client.post(
            "/api/v1/oauth2/consent", params=params, data={"action": "deny"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=access_denied" in location

    @pytest.mark.override_current_user
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
        }
        response = await client.post(
            "/api/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

        grant = oauth2_grant_service._get_by_sub_and_client_id(
            sync_session,
            sub_type=SubType.user,
            sub_id=user.id,
            client_id=cast(str, oauth2_client.client_id),
        )
        assert grant is not None
        assert grant.scopes == ["openid", "profile", "email"]

    @pytest.mark.override_current_user
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
            "/api/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 400
        json = response.json()
        assert json["error"] == "invalid_sub"

    @pytest.mark.override_current_user
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
            "/api/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 400
        json = response.json()
        assert json["error"] == "invalid_sub"

    @pytest.mark.override_current_user
    async def test_organization_deny(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
            "/api/v1/oauth2/consent", params=params, data={"action": "deny"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert "error=access_denied" in location

    @pytest.mark.override_current_user
    async def test_organization_allow(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
            "/api/v1/oauth2/consent", params=params, data={"action": "allow"}
        )

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith(params["redirect_uri"])
        assert "code=" in location

        grant = oauth2_grant_service._get_by_sub_and_client_id(
            sync_session,
            sub_type=SubType.organization,
            sub_id=organization.id,
            client_id=cast(str, oauth2_client.client_id),
        )
        assert grant is not None
        assert grant.scopes == ["openid", "profile", "email"]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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

        response = await client.post("/api/v1/oauth2/token", data=data)

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

        response = await client.post("/api/v1/oauth2/token", data=data)

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

        response = await client.post("/api/v1/oauth2/token", data=data)

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

        response = await client.post("/api/v1/oauth2/token", data=data)

        assert response.status_code == 200
        json = response.json()

        access_token = json["access_token"]
        assert access_token.startswith("polar_at_o_")
        refresh_token = json["refresh_token"]
        assert refresh_token.startswith("polar_rt_o_")
