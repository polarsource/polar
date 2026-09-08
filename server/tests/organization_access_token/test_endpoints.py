from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import (
    OAuth2Client,
    OAuth2Token,
    Organization,
    OrganizationAccessToken,
    User,
    UserOrganization,
)
from tests.fixtures.auth import AuthSubjectFixture, make_session_stale
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestOAuthAuthentication:
    @pytest.fixture(autouse=True)
    def oauth_session(self, auth_subject: AuthSubject[User]) -> None:
        auth_subject.session = OAuth2Token(client=OAuth2Client())

    @pytest.mark.auth(
        AuthSubjectFixture(
            scopes={Scope.organization_access_tokens_write, Scope.metrics_read}
        )
    )
    async def test_token_lifecycle(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(organization.id),
                "comment": "OAuth token",
                "scopes": ["metrics:read"],
            },
        )
        assert response.status_code == 201
        token_id = response.json()["organization_access_token"]["id"]

        response = await client.get("/v1/organization-access-tokens/")
        assert response.status_code == 200
        assert [item["id"] for item in response.json()["items"]] == [token_id]

        response = await client.patch(
            f"/v1/organization-access-tokens/{token_id}",
            json={"comment": "updated"},
        )
        assert response.status_code == 200
        assert response.json()["comment"] == "updated"

        response = await client.delete(f"/v1/organization-access-tokens/{token_id}")
        assert response.status_code == 204
        response = await client.get("/v1/organization-access-tokens/")
        assert response.status_code == 200
        assert response.json()["items"] == []

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organization_access_tokens_read})
    )
    async def test_read_only(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/organization-access-tokens/")
        assert response.status_code == 200

        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(organization.id),
                "comment": "forbidden",
                "scopes": ["metrics:read"],
            },
        )
        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.organization_access_tokens_write})
    )
    async def test_cannot_escalate_scopes(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(organization.id),
                "comment": "forbidden",
                "scopes": ["orders:write"],
            },
        )
        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", "scopes"]


async def _build_oat(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    scopes: set[Scope],
    comment: str = "existing",
) -> OrganizationAccessToken:
    token = OrganizationAccessToken(
        comment=comment,
        token=get_token_hash("polar_oat_test", secret=settings.SECRET),
        organization=organization,
        expires_at=utc_now() + timedelta(days=1),
        scope=" ".join(s.value for s in scopes),
    )
    await save_fixture(token)
    return token


@pytest.mark.asyncio
class TestCreateOrganizationAccessToken:
    @pytest.mark.parametrize("expires_in", [None, 3600])
    @pytest.mark.auth
    async def test_valid(
        self,
        expires_in: int | None,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(organization.id),
                "comment": "hello world",
                "scopes": ["metrics:read"],
                "expires_in": expires_in,
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "organization_access_token" in response.json()
        assert "token" in json

    @pytest.mark.auth
    async def test_stale_session(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(organization.id),
                "comment": "hello world",
                "scopes": ["metrics:read"],
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization",
            scopes={
                Scope.organization_access_tokens_write,
            },
        )
    )
    async def test_oat_caller_cannot_mint(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "comment": "elevated",
                "scopes": ["orders:write"],
            },
        )

        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdateOrganizationAccessToken:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        existing = await _build_oat(
            save_fixture, organization, scopes={Scope.metrics_read}
        )

        response = await client.patch(
            f"/v1/organization-access-tokens/{existing.id}",
            json={"comment": "updated"},
        )

        assert response.status_code == 200
        assert response.json()["comment"] == "updated"

    @pytest.mark.auth
    async def test_stale_session(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        existing = await _build_oat(
            save_fixture, organization, scopes={Scope.metrics_read}
        )
        make_session_stale(auth_subject)

        response = await client.patch(
            f"/v1/organization-access-tokens/{existing.id}",
            json={"comment": "updated"},
        )

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization",
            scopes={
                Scope.organization_access_tokens_write,
            },
        )
    )
    async def test_oat_caller_cannot_update(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        existing = await _build_oat(
            save_fixture, organization, scopes={Scope.metrics_read}
        )

        response = await client.patch(
            f"/v1/organization-access-tokens/{existing.id}",
            json={"scopes": ["orders:write"]},
        )

        assert response.status_code == 401
