from unittest.mock import Mock

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
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
        assert await counts(session, organization) == [0] * 6

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
