from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import (
    Organization,
    VoidDeployment,
    VoidOrganizationSettings,
    VoidReducer,
)
from polar.postgres import AsyncSession
from polar.void.reducer.aggregation import CountAggregation
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token
from tests.void.test_models import create_meter, create_product

PATH = "/v1/void/organizations/current"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
VERSION = "a" * 64


@pytest.mark.asyncio
class TestDefaultVersion:
    async def test_current_and_clearing_empty_default_do_not_create_settings(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        responses = [
            await void_client.get(PATH, headers=HEADERS),
            await void_client.patch(
                PATH, headers=HEADERS, json={"default_version_id": None}
            ),
        ]
        for response in responses:
            assert response.status_code == 200
            assert response.json()["default_version_id"] is None
        assert (
            await session.scalar(
                select(func.count()).select_from(VoidOrganizationSettings)
            )
            == 0
        )

    async def test_select_and_clear_version_changes_latest_resolution(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        await save_fixture(create_product(organization, version=VERSION))
        for version, checksum in ((VERSION, "named"), (None, "unnamed")):
            await save_fixture(
                VoidDeployment(
                    organization=organization,
                    version_id=version,
                    checksum=checksum,
                    entries=[],
                )
            )
        response = await void_client.patch(
            PATH, headers=HEADERS, json={"default_version_id": VERSION}
        )
        assert response.status_code == 200
        assert response.json()["default_version_id"] == VERSION
        selected = await void_client.get("/v1/void/deploys/latest", headers=HEADERS)
        assert selected.json()["checksum"] == "named"
        unnamed = await void_client.get(
            "/v1/void/deploys/latest", headers=HEADERS, params={"version_id": ""}
        )
        assert unnamed.json()["checksum"] == "unnamed"
        response = await void_client.patch(
            PATH, headers=HEADERS, json={"default_version_id": None}
        )
        assert response.status_code == 200
        assert response.json()["default_version_id"] is None
        selected = await void_client.get("/v1/void/deploys/latest", headers=HEADERS)
        assert selected.json()["checksum"] == "unnamed"

    @pytest.mark.parametrize(
        "reason", ["foreign", "archived", "deleted", "missing", "branch"]
    )
    async def test_rejects_unavailable_version(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        session: AsyncSession,
        reason: str,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        if reason == "branch":
            reducer = VoidReducer(
                organization=organization, slug="usage", aggregation=CountAggregation()
            )
            await save_fixture(reducer)
            await save_fixture(
                create_meter(organization, reducer, version=VERSION, branch=uuid4())
            )
        elif reason != "missing":
            product = create_product(
                organization_second if reason == "foreign" else organization,
                version=VERSION,
            )
            if reason == "archived":
                product.archived_at = utc_now()
            if reason == "deleted":
                product.deleted_at = utc_now()
            await save_fixture(product)
        response = await void_client.patch(
            PATH, headers=HEADERS, json={"default_version_id": VERSION}
        )
        assert response.status_code == 400
        assert (
            await session.scalar(
                select(func.count()).select_from(VoidOrganizationSettings)
            )
            == 0
        )

    async def test_meter_only_version_can_be_selected(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        reducer = VoidReducer(
            organization=organization, slug="usage", aggregation=CountAggregation()
        )
        await save_fixture(reducer)
        await save_fixture(create_meter(organization, reducer, version=VERSION))
        response = await void_client.patch(
            PATH, headers=HEADERS, json={"default_version_id": VERSION}
        )
        assert response.status_code == 200
        assert response.json()["default_version_id"] == VERSION

    async def test_read_token_cannot_select_version(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        response = await void_client.patch(
            PATH, headers=HEADERS, json={"default_version_id": None}
        )
        assert response.status_code == 403
