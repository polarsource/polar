from datetime import timedelta

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationAccessToken, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


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

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization",
            scopes={
                Scope.web_write,
                Scope.organization_access_tokens_write,
            },
        )
    )
    async def test_oat_caller_cannot_mint_broader_scope(
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

        assert response.status_code == 422
        body = response.json()
        assert any(
            err.get("loc") == ["body", "scopes"] for err in body.get("detail", [])
        )

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization",
            scopes={
                Scope.web_write,
                Scope.organization_access_tokens_write,
                Scope.metrics_read,
            },
        )
    )
    async def test_oat_caller_within_scope_ok(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "comment": "within scope",
                "scopes": ["metrics:read"],
            },
        )

        assert response.status_code == 201


@pytest.mark.asyncio
class TestUpdateOrganizationAccessToken:
    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization",
            scopes={
                Scope.web_write,
                Scope.organization_access_tokens_write,
            },
        )
    )
    async def test_oat_caller_cannot_elevate_scopes(
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

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(
            subject="organization",
            scopes={
                Scope.web_write,
                Scope.organization_access_tokens_write,
                Scope.metrics_read,
            },
        )
    )
    async def test_oat_caller_within_scope_ok(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        existing: OrganizationAccessToken = await _build_oat(
            save_fixture,
            organization,
            scopes={Scope.metrics_read},
            comment="update_within_scope",
        )

        response = await client.patch(
            f"/v1/organization-access-tokens/{existing.id}",
            json={"scopes": ["metrics:read"]},
        )

        assert response.status_code == 200
