from unittest.mock import Mock

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from polar.auth.scope import Scope
from polar.models import Organization
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.postgres import AsyncSession
from polar.void.deploy import endpoints
from polar.void.tinybird import TinybirdApi
from tests.fixtures.database import SaveFixture
from tests.void.deploy.test_service import CONFIG, counts
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/deploys"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.asyncio
class TestDeployEndpoints:
    async def test_apply_plan_and_latest(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(
            PATH, headers=HEADERS, json={**CONFIG, "dry_run": True}
        )
        assert response.status_code == 201
        plan = response.json()
        assert plan["applied"] is False
        assert (
            await void_client.get(
                f"{PATH}/latest",
                headers=HEADERS,
                params={"version_id": plan["version_id"]},
            )
        ).status_code == 404
        response = await void_client.post(PATH, headers=HEADERS, json=CONFIG)
        assert response.status_code == 201
        deployed = response.json()
        assert deployed["status"] == "draft"
        latest = await void_client.get(
            f"{PATH}/latest",
            headers=HEADERS,
            params={"version_id": deployed["version_id"]},
        )
        assert latest.status_code == 200
        assert latest.json() == deployed
        assert (
            await void_client.get(f"{PATH}/latest", headers=HEADERS)
        ).status_code == 404
        activated = await void_client.post(
            f"{PATH}/{deployed['id']}/activate", headers=HEADERS
        )
        assert activated.status_code == 200
        assert activated.json()["status"] == "active"
        active = await void_client.get(f"{PATH}/latest", headers=HEADERS)
        assert active.status_code == 200
        assert active.json()["id"] == deployed["id"]
        listed = await void_client.get(PATH, headers=HEADERS)
        assert [d["id"] for d in listed.json()] == [deployed["id"]]
        single = await void_client.get(f"{PATH}/{deployed['id']}", headers=HEADERS)
        assert single.json() == active.json()
        organization_response = await void_client.get(
            "/v1/void/organizations/current", headers=HEADERS
        )
        assert organization_response.json()["active_deployment_id"] == deployed["id"]
        assert (
            organization_response.json()["active_version_id"] == deployed["version_id"]
        )

    async def test_configuration_is_the_stored_deploy_body(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        deployed = (await void_client.post(PATH, headers=HEADERS, json=CONFIG)).json()
        response = await void_client.get(
            f"{PATH}/{deployed['id']}/configuration", headers=HEADERS
        )
        assert response.status_code == 200
        configuration = response.json()
        assert set(configuration) == {"reducers", "meters", "entitlements", "products"}
        assert [m["slug"] for m in configuration["meters"]] == ["tokens"]
        assert configuration["products"][0]["meters"] == [
            {"slug": "tokens", "included": 100, "limit": "hard", "rollover_cap": 0}
        ]
        assert (
            await void_client.get(
                f"{PATH}/{deployed['id']}/configuration",
                headers={"Authorization": "Bearer wrong"},
            )
        ).status_code == 401

    async def test_activate_requires_write_scope_and_reviewed_organization(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        deployed = (await void_client.post(PATH, headers=HEADERS, json=CONFIG)).json()
        # The client expunges the organization after each request; update by row.
        await session.execute(
            update(Organization)
            .where(Organization.id == organization.id)
            .values(capabilities={**STATUS_CAPABILITIES[OrganizationStatus.CREATED]})
        )
        response = await void_client.post(
            f"{PATH}/{deployed['id']}/activate", headers=HEADERS
        )
        assert response.status_code == 403
        current = await void_client.get(
            "/v1/void/organizations/current", headers=HEADERS
        )
        assert current.json()["can_activate"] is False
        assert current.json()["active_deployment_id"] is None

    async def test_read_scope_cannot_plan_or_apply(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        for dry_run in (False, True):
            assert (
                await void_client.post(
                    PATH, headers=HEADERS, json={**CONFIG, "dry_run": dry_run}
                )
            ).status_code == 403
        assert (
            await void_client.get(f"{PATH}/latest", headers=HEADERS)
        ).status_code == 404
        assert (
            await void_client.post(
                f"{PATH}/{organization.id}/activate", headers=HEADERS
            )
        ).status_code == 403

    async def test_preview_plans_and_leaves_database_empty(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
        organization: Organization,
    ) -> None:
        await create_token(
            save_fixture, organization, scopes={Scope.void_write, Scope.customers_read}
        )
        monkeypatch.setattr(
            endpoints, "get_client", lambda: iter([Mock(spec=TinybirdApi)])
        )
        response = await void_client.post(
            PATH,
            headers=HEADERS,
            json={
                **CONFIG,
                "dry_run": True,
                "preview": {"start": "2026-01-01", "end": "2026-02-01"},
            },
        )
        assert response.status_code == 201
        assert not response.json()["applied"]
        assert await counts(session, organization) == [0] * 5

    async def test_preview_requires_customer_read_scope(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(
            PATH,
            headers=HEADERS,
            json={
                **CONFIG,
                "dry_run": True,
                "preview": {"start": "2026-01-01", "end": "2026-02-01"},
            },
        )
        assert response.status_code == 403
