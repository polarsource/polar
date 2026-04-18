import pytest
from httpx import AsyncClient

from polar.models import Organization, UserOrganization


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
