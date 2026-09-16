import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization, VoidDeployment
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/organizations/current"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
VERSION = "a" * 64


@pytest.mark.asyncio
class TestCurrentOrganization:
    async def test_without_deployments(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        response = await void_client.get(PATH, headers=HEADERS)
        assert response.status_code == 200
        body = response.json()
        assert body["active_deployment_id"] is None
        assert body["active_version_id"] is None
        assert body["can_activate"] is True

    async def test_reports_the_active_deployment(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        archived = VoidDeployment(
            organization=organization,
            version_id="b" * 64,
            checksum="old",
            status="archived",
            entries=[],
        )
        active = VoidDeployment(
            organization=organization,
            version_id=VERSION,
            checksum="current",
            status="active",
            entries=[],
        )
        await save_fixture(archived)
        await save_fixture(active)
        response = await void_client.get(PATH, headers=HEADERS)
        assert response.json()["active_deployment_id"] == str(active.id)
        assert response.json()["active_version_id"] == VERSION
        latest = await void_client.get("/v1/void/deploys/latest", headers=HEADERS)
        assert latest.json()["checksum"] == "current"
        explicit = await void_client.get(
            "/v1/void/deploys/latest",
            headers=HEADERS,
            params={"version_id": "b" * 64},
        )
        assert explicit.json()["checksum"] == "old"
        assert explicit.json()["status"] == "archived"

    async def test_no_update_endpoint(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.patch(
            PATH, headers=HEADERS, json={"default_version_id": VERSION}
        )
        assert response.status_code == 405
