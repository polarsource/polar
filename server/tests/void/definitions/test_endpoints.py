import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.void.deploy.test_service import CONFIG
from tests.void.test_endpoints import TOKEN, create_token

PREFIX = "/v1/void"


@pytest.mark.asyncio
class TestDefinitionRoutes:
    async def test_deployed_definitions_are_readable_within_the_organization(
        self,
        void_client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        headers = {"Authorization": f"Bearer {TOKEN}"}
        deployed = await void_client.post(
            f"{PREFIX}/deploys", headers=headers, json=CONFIG
        )
        assert deployed.status_code == 201, deployed.text
        version = deployed.json()["version_id"]
        rows = {}
        for resource in ("meters", "entitlements", "products"):
            response = await void_client.get(f"{PREFIX}/{resource}", headers=headers)
            assert response.status_code == 200
            assert len(response.json()) == 1
            rows[resource] = response.json()[0]
            single = await void_client.get(
                f"{PREFIX}/{resource}/{rows[resource]['id']}", headers=headers
            )
            assert single.status_code == 200
            assert single.json() == rows[resource]
        assert rows["meters"]["version_id"] == version
        assert rows["products"]["version_id"] == version
        assert rows["products"]["meters"] == [rows["meters"]]
        assert rows["products"]["entitlements"] == [rows["entitlements"]]
        assert rows["products"]["meter_terms"]["tokens"] == {
            "included": 100,
            "limit": "hard",
            "rollover_cap": 0,
        }
        filtered = await void_client.get(
            f"{PREFIX}/products", headers=headers, params={"version_id": "0" * 64}
        )
        assert filtered.json() == []
        second_token = f"{TOKEN}_second"
        await create_token(save_fixture, organization_second, token=second_token)
        organization_second.feature_settings = {
            **organization_second.feature_settings,
            "void_enabled": True,
        }
        await save_fixture(organization_second)
        second_headers = {"Authorization": f"Bearer {second_token}"}
        for resource, row in rows.items():
            response = await void_client.get(
                f"{PREFIX}/{resource}/{row['id']}", headers=second_headers
            )
            assert response.status_code == 404
            response = await void_client.get(
                f"{PREFIX}/{resource}", headers=second_headers
            )
            assert response.json() == []

    @pytest.mark.parametrize("resource", ["meters", "products"])
    async def test_meters_and_products_are_only_written_by_deploys(
        self,
        void_client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
        resource: str,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(
            f"{PREFIX}/{resource}",
            headers={"Authorization": f"Bearer {TOKEN}"},
            json={"slug": "x"},
        )
        assert response.status_code == 405

    async def test_read_scope_cannot_create(
        self,
        void_client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await create_token(save_fixture, organization)
        response = await void_client.post(
            f"{PREFIX}/entitlements",
            headers={"Authorization": f"Bearer {TOKEN}"},
            json={"slug": "export"},
        )
        assert response.status_code == 403
