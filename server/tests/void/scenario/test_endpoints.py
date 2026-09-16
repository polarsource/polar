import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.void.deploy.test_service import CONFIG
from tests.void.scenario.test_service import PATCH
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/scenarios"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.asyncio
class TestScenarioEndpoints:
    async def test_lifecycle(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        deployed = (
            await void_client.post("/v1/void/deploys", headers=HEADERS, json=CONFIG)
        ).json()

        response = await void_client.post(
            PATH,
            headers=HEADERS,
            json={"name": "Usage-first", "base_version_id": deployed["version_id"]},
        )
        assert response.status_code == 201
        scenario = response.json()
        assert scenario["base_deployment_id"] == deployed["id"]
        assert scenario["version_id"] == deployed["version_id"]
        assert scenario["deployment_id"] == deployed["id"]

        response = await void_client.patch(
            f"{PATH}/{scenario['id']}", headers=HEADERS, json={"patch": PATCH}
        )
        assert response.status_code == 200
        assert response.json()["version_id"] != deployed["version_id"]
        assert response.json()["deployment_id"] is None

        response = await void_client.patch(
            f"{PATH}/{scenario['id']}",
            headers=HEADERS,
            json={"patch": {"products": {"missing": {"name": "x"}}}},
        )
        assert response.status_code == 400

        response = await void_client.post(
            f"{PATH}/{scenario['id']}/promote", headers=HEADERS
        )
        assert response.status_code == 201
        promoted = response.json()
        assert promoted["status"] == "draft"
        assert promoted["checksum"] == f"scenario:{scenario['id']}"

        listed = (await void_client.get(PATH, headers=HEADERS)).json()
        assert [b["id"] for b in listed] == [scenario["id"]]
        assert listed[0]["promoted_deployment_id"] == promoted["id"]

        deploys = (await void_client.get("/v1/void/deploys", headers=HEADERS)).json()
        assert {d["id"] for d in deploys} == {deployed["id"], promoted["id"]}

        assert (
            await void_client.delete(f"{PATH}/{scenario['id']}", headers=HEADERS)
        ).status_code == 204
        assert (
            await void_client.get(f"{PATH}/{scenario['id']}", headers=HEADERS)
        ).status_code == 404

    async def test_write_requires_write_scope(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        assert (await void_client.get(PATH, headers=HEADERS)).status_code == 200
        response = await void_client.post(
            PATH, headers=HEADERS, json={"name": "x", "base_version_id": "a" * 64}
        )
        assert response.status_code == 403
