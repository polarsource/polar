import pytest
from httpx import AsyncClient

from polar.models import Organization

from .conftest import IssuesPledgesFixture


@pytest.mark.asyncio
class TestListFunding:
    async def test_missing_organization_name(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/funding/", params={"platform": "github"})

        assert response.status_code == 422

    async def test_unknown_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/funding/",
            params={"platform": "github", "organization_name": "not-existing"},
        )

        assert response.status_code == 404

    async def test_unknown_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/funding/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not-existing",
            },
        )

        assert response.status_code == 404

    async def test_valid(
        self,
        issues_pledges: IssuesPledgesFixture,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.get(
            "/api/v1/funding/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == len(issues_pledges)

    async def test_sorting(
        self,
        issues_pledges: IssuesPledgesFixture,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.get(
            "/api/v1/funding/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "sorting": ["newest", "most_funded"],
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["items"][0]["issue"]["id"] == str(issues_pledges[-1][0].id)
