import pytest
from httpx import AsyncClient

from polar.models import (
    ExternalOrganization,
    Organization,
    Repository,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_repository

from .conftest import IssuesPledgesFixture, create_issues_pledges


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearch:
    async def test_missing_organization_name(self, client: AsyncClient) -> None:
        response = await client.get("/v1/funding/search", params={"platform": "github"})

        assert response.status_code == 422

    async def test_unknown_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/funding/search",
            params={"platform": "github", "organization_name": "not-existing"},
        )

        assert response.status_code == 404

    async def test_unknown_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/funding/search",
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
        save_fixture: SaveFixture,
    ) -> None:
        repository.is_private = False
        await save_fixture(repository)

        response = await client.get(
            "/v1/funding/search",
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
        save_fixture: SaveFixture,
    ) -> None:
        repository.is_private = False
        await save_fixture(repository)

        response = await client.get(
            "/v1/funding/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "sorting": ["newest", "most_funded"],
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["items"][0]["issue"]["id"] == str(issues_pledges[-1][0].id)

    async def test_anonymous_private_repository(
        self,
        client: AsyncClient,
        external_organization: ExternalOrganization,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        private_repository = await create_repository(
            save_fixture, external_organization, is_private=True
        )
        issues_pledges = await create_issues_pledges(
            save_fixture, external_organization, organization, private_repository
        )

        # then
        session.expunge_all()

        response = await client.get(
            "/v1/funding/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0
        assert len(json["items"]) == 0

    @pytest.mark.auth
    async def test_user_private_repository(
        self,
        client: AsyncClient,
        external_organization: ExternalOrganization,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        private_repository = await create_repository(
            save_fixture, external_organization, is_private=True
        )
        issues_pledges = await create_issues_pledges(
            save_fixture, external_organization, organization, private_repository
        )

        # then
        session.expunge_all()

        response = await client.get(
            "/v1/funding/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == len(issues_pledges)

    async def test_pagination(
        self,
        issues_pledges: IssuesPledgesFixture,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.get(
            "/v1/funding/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "sorting": ["newest"],
                "limit": 1,
                "page": 3,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 1
        assert json["pagination"]["total_count"] == len(issues_pledges)
        assert json["pagination"]["max_page"] == len(issues_pledges)
        assert json["items"][0]["issue"]["id"] == str(issues_pledges[0][0].id)
