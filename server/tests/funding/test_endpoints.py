import pytest
from httpx import AsyncClient

from polar.models import Organization
from polar.models.repository import Repository
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from polar.config import settings

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
        repository: Repository,
        session: AsyncSession,
    ) -> None:
        repository.is_private = False
        await repository.save(session)

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
        repository: Repository,
        session: AsyncSession,
    ) -> None:
        repository.is_private = False
        await repository.save(session)

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

    async def test_private_repository(
        self,
        issues_pledges: IssuesPledgesFixture,
        repository: Repository,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        session: AsyncSession,
        auth_jwt: str,
    ) -> None:
        repository.is_private = True
        await repository.save(session)

        response = await client.get(
            "/api/v1/funding/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 0

        # authed user can see

        response = await client.get(
            "/api/v1/funding/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == len(issues_pledges)
