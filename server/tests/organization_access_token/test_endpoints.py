import uuid

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair
from polar.models import Organization, OrganizationAccessToken, UserOrganization
from polar.organization_access_token.service import TOKEN_PREFIX
from tests.fixtures.database import SaveFixture


async def _create_token(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    comment: str = "test token",
    scope: str = "metrics:read",
) -> OrganizationAccessToken:
    _, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    record = OrganizationAccessToken(
        organization=organization,
        comment=comment,
        token=token_hash,
        scope=scope,
        expires_at=None,
    )
    await save_fixture(record)
    return record


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

    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(uuid.uuid4()),
                "comment": "hello",
                "scopes": ["metrics:read"],
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_other_organization_rejected(
        self,
        client: AsyncClient,
        organization_second: Organization,
    ) -> None:
        """
        A user must not be able to create an access token for an organization
        they're not a member of — even if they know the org's UUID.
        """
        response = await client.post(
            "/v1/organization-access-tokens/",
            json={
                "organization_id": str(organization_second.id),
                "comment": "attacker",
                "scopes": ["metrics:read"],
            },
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestUpdateOrganizationAccessToken:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/organization-access-tokens/{uuid.uuid4()}",
            json={"comment": "x"},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_other_organization_token_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        """A user must not be able to update tokens that belong to a foreign org."""
        foreign_token = await _create_token(save_fixture, organization_second)

        response = await client.patch(
            f"/v1/organization-access-tokens/{foreign_token.id}",
            json={"comment": "hijacked"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteOrganizationAccessToken:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/organization-access-tokens/{uuid.uuid4()}")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_other_organization_token_returns_404(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        """A user must not be able to revoke tokens that belong to a foreign org."""
        foreign_token = await _create_token(save_fixture, organization_second)

        response = await client.delete(
            f"/v1/organization-access-tokens/{foreign_token.id}"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestListOrganizationAccessTokens:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/organization-access-tokens/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_organization_id_filter_cannot_leak_cross_org(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        """
        Passing an organization_id the caller can't access must not leak
        tokens from that organization — equivalent pattern to the metrics
        filter bug fixed in #11067.
        """
        await _create_token(save_fixture, organization_second, comment="foreign")

        response = await client.get(
            "/v1/organization-access-tokens/",
            params={"organization_id": str(organization_second.id)},
        )
        assert response.status_code == 200
        assert response.json()["items"] == []
