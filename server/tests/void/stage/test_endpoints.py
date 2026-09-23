from copy import deepcopy

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.postgres import AsyncSession
from polar.void.deploy.schemas import DeployConfiguration
from tests.fixtures.database import SaveFixture
from tests.void.deploy.test_service import CONFIG, counts
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/stage"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
CONFIGURATION = DeployConfiguration.model_validate(CONFIG).model_dump(mode="json")


@pytest.mark.asyncio
class TestStage:
    async def test_save_replace_discard_and_recreate(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        assert (await void_client.get(PATH, headers=HEADERS)).status_code == 404

        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        assert response.status_code == 200
        saved = response.json()
        assert saved == {"revision": 1, "configuration": CONFIGURATION}
        assert (await void_client.get(PATH, headers=HEADERS)).json() == saved
        assert await counts(session, organization) == [0] * 5

        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": 1, "configuration": {}},
        )
        assert response.status_code == 200
        assert response.json() == {
            "revision": 2,
            "configuration": DeployConfiguration().model_dump(mode="json"),
        }
        response = await void_client.delete(
            PATH, headers=HEADERS, params={"expected_revision": 2}
        )
        assert response.status_code == 204
        assert (await void_client.get(PATH, headers=HEADERS)).status_code == 404

        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        assert response.status_code == 200
        recreated = response.json()
        assert recreated["revision"] == 3
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": 1, "configuration": {}},
        )
        assert response.status_code == 409
        assert (await void_client.get(PATH, headers=HEADERS)).json() == recreated

    async def test_stale_revision_cannot_save_discard_or_deploy(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": 1, "configuration": CONFIGURATION},
        )
        saved = response.json()
        for expected_revision in (None, 1):
            response = await void_client.put(
                PATH,
                headers=HEADERS,
                json={"expected_revision": expected_revision, "configuration": {}},
            )
            assert response.status_code == 409
            assert response.json()["error"] == "StageConflict"
        response = await void_client.delete(
            PATH, headers=HEADERS, params={"expected_revision": 1}
        )
        assert response.status_code == 409
        for dry_run in (True, False):
            response = await void_client.post(
                f"{PATH}/deploy",
                headers=HEADERS,
                json={"expected_revision": 1, "dry_run": dry_run},
            )
            assert response.status_code == 409
            assert response.json()["error"] == "StageConflict"
        assert (await void_client.get(PATH, headers=HEADERS)).json() == saved
        assert await counts(session, organization) == [0] * 5

    @pytest.mark.parametrize("activate", [False, True])
    async def test_only_successful_deployments_clear_stage(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
        activate: bool,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        saved = response.json()
        response = await void_client.post(
            f"{PATH}/deploy",
            headers=HEADERS,
            json={"expected_revision": 1, "dry_run": True},
        )
        assert response.status_code == 201
        plan = response.json()
        assert plan["applied"] is False
        assert plan["id"] is None
        assert await counts(session, organization) == [0] * 5
        assert (await void_client.get(PATH, headers=HEADERS)).json() == saved
        response = await void_client.post(
            f"{PATH}/deploy",
            headers=HEADERS,
            json={"expected_revision": 1, "activate": activate},
        )
        assert response.status_code == 201
        deployed = response.json()
        assert deployed["applied"] is True
        assert deployed["status"] == ("active" if activate else "draft")
        assert deployed["version_id"] == plan["version_id"]
        assert (await void_client.get(PATH, headers=HEADERS)).status_code == 404
        resources = await counts(session, organization)
        assert resources == [2, 1, 1, 1, 1]
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        recreated = response.json()
        assert recreated["revision"] == 2
        for dry_run in (True, False):
            response = await void_client.post(
                f"{PATH}/deploy",
                headers=HEADERS,
                json={"expected_revision": 2, "dry_run": dry_run},
            )
            assert response.status_code == 201
            assert response.json() == deployed
            current_stage = await void_client.get(PATH, headers=HEADERS)
            if dry_run:
                assert current_stage.json() == recreated
            else:
                assert current_stage.status_code == 404
        assert await counts(session, organization) == resources
        current = await void_client.get(
            "/v1/void/organizations/current", headers=HEADERS
        )
        assert current.json()["active_version_id"] == (
            deployed["version_id"] if activate else None
        )

    async def test_failed_activation_preserves_stage(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        organization.capabilities = {**STATUS_CAPABILITIES[OrganizationStatus.CREATED]}
        await save_fixture(organization)
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        saved = (
            await void_client.put(
                PATH,
                headers=HEADERS,
                json={"expected_revision": None, "configuration": CONFIGURATION},
            )
        ).json()
        for dry_run, status in ((False, 403), (True, 400)):
            response = await void_client.post(
                f"{PATH}/deploy",
                headers=HEADERS,
                json={"expected_revision": 1, "activate": True, "dry_run": dry_run},
            )
            assert response.status_code == status
            assert (await void_client.get(PATH, headers=HEADERS)).json() == saved
            assert await counts(session, organization) == [0] * 5

    async def test_direct_deployment_is_independent_of_stage(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        saved = response.json()
        direct_config = deepcopy(CONFIG)
        direct_config["meters"][0]["unit_amount"] = "0.02"
        response = await void_client.post(
            "/v1/void/deploys", headers=HEADERS, json=direct_config
        )
        assert response.status_code == 201
        direct = response.json()
        response = await void_client.post(
            f"/v1/void/deploys/{direct['id']}/activate", headers=HEADERS
        )
        assert response.status_code == 200
        assert (await void_client.get(PATH, headers=HEADERS)).json() == saved

        response = await void_client.post(
            f"{PATH}/deploy", headers=HEADERS, json={"expected_revision": 1}
        )
        assert response.status_code == 201
        staged_deployment = response.json()
        assert staged_deployment["version_id"] != direct["version_id"]
        assert staged_deployment["status"] == "draft"
        stored = await void_client.get(
            f"/v1/void/deploys/{staged_deployment['id']}/configuration", headers=HEADERS
        )
        assert stored.json() == CONFIGURATION
        current = await void_client.get(
            "/v1/void/organizations/current", headers=HEADERS
        )
        assert current.json()["active_version_id"] == direct["version_id"]
        response = await void_client.post(
            "/v1/void/deploys", headers=HEADERS, json=CONFIG
        )
        assert response.json()["id"] == staged_deployment["id"]

    @pytest.mark.parametrize("invalid", ["unknown_meter", "reserved_reducer"])
    async def test_invalid_deployment_preserves_stage_and_writes_no_resources(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
        invalid: str,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        configuration = deepcopy(CONFIGURATION)
        if invalid == "unknown_meter":
            configuration["products"][0]["meters"] = ["unknown"]
        else:
            configuration["reducers"][0]["slug"] = "void-identity-entitlements"
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": configuration},
        )
        assert response.status_code == 200
        saved = response.json()
        for dry_run in (True, False):
            response = await void_client.post(
                f"{PATH}/deploy",
                headers=HEADERS,
                json={"expected_revision": 1, "dry_run": dry_run},
            )
            assert response.status_code == 400
            assert response.json()["detail"]
        assert await counts(session, organization) == [0] * 5
        assert (await void_client.get(PATH, headers=HEADERS)).json() == saved

    async def test_organization_isolation_and_write_scope(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        read_token = f"{TOKEN}_read"
        await create_token(
            save_fixture, organization, scopes={Scope.void_read}, token=read_token
        )
        organization_second.feature_settings = {"void_enabled": True}
        await save_fixture(organization_second)
        other_token = f"{TOKEN}_other"
        await create_token(
            save_fixture,
            organization_second,
            scopes={Scope.void_write},
            token=other_token,
        )
        response = await void_client.put(
            PATH,
            headers=HEADERS,
            json={"expected_revision": None, "configuration": CONFIGURATION},
        )
        saved = response.json()
        read_headers = {"Authorization": f"Bearer {read_token}"}
        assert (await void_client.get(PATH, headers=read_headers)).json() == saved
        assert (
            await void_client.put(
                PATH,
                headers=read_headers,
                json={"expected_revision": 1, "configuration": {}},
            )
        ).status_code == 403
        assert (
            await void_client.delete(
                PATH,
                headers=read_headers,
                params={"expected_revision": 1},
            )
        ).status_code == 403
        assert (
            await void_client.post(
                f"{PATH}/deploy",
                headers=read_headers,
                json={"expected_revision": 1},
            )
        ).status_code == 403

        other_headers = {"Authorization": f"Bearer {other_token}"}
        assert (await void_client.get(PATH, headers=other_headers)).status_code == 404
        assert (
            await void_client.delete(
                PATH,
                headers=other_headers,
                params={"expected_revision": 1},
            )
        ).status_code == 404
        assert (
            await void_client.post(
                f"{PATH}/deploy",
                headers=other_headers,
                json={"expected_revision": 1},
            )
        ).status_code == 404
        response = await void_client.put(
            PATH,
            headers=other_headers,
            json={"expected_revision": None, "configuration": {}},
        )
        assert response.status_code == 200
        assert response.json()["revision"] == 1
        assert (await void_client.get(PATH, headers=HEADERS)).json() == saved
