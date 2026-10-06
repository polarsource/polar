import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.meter.repository import MeterRepository
from polar.models import Meter, Organization, UserOrganization
from polar.postgres import AsyncSession
from polar.version import V2026_04, V2026_10, V2027_01
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_meter


@pytest_asyncio.fixture
async def meter_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
) -> Meter:
    return await create_meter(
        save_fixture,
        id=uuid.uuid4(),
        organization=organization_second,
    )


@pytest.mark.asyncio
class TestListMeters:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/meters/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_meters(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        meter_organization_second: Meter,
    ) -> None:
        response = await client.get("/v1/meters/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestGetMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/meters/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_meter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        meter_organization_second: Meter,
    ) -> None:
        response = await client.get(f"/v1/meters/{meter_organization_second.id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetMeterQuantities:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/meters/{uuid.uuid4()}/quantities")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_meter_quantities(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        meter_organization_second: Meter,
    ) -> None:
        response = await client.get(
            f"/v1/meters/{meter_organization_second.id}/quantities",
            params={
                "start_timestamp": "2024-01-01T00:00:00Z",
                "end_timestamp": "2024-01-31T00:00:00Z",
                "interval": "day",
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_interval_too_small_for_range(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        meter: Meter,
    ) -> None:
        response = await client.get(
            f"/v1/meters/{meter.id}/quantities",
            params={
                "start_timestamp": "2024-01-01T00:00:00Z",
                "end_timestamp": "2024-01-31T00:00:00Z",
                "interval": "hour",
            },
        )

        assert response.status_code == 422
        msg = response.json()["detail"][0]["msg"]
        assert "too small" in msg.lower()
        assert "too big" not in msg.lower()


@pytest.mark.asyncio
class TestCreateMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/meters/")

        assert response.status_code == 401

    @pytest.mark.api_version(V2026_04, V2026_10)
    @pytest.mark.auth
    async def test_external_id_ignored_before_2027_01(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="ext_1337"
        )

        response = await client.post(
            "/v1/meters/",
            json={
                "name": "Meter",
                "organization_id": str(organization.id),
                "external_id": "ext_1337",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert "external_id" not in json
        meter = await MeterRepository.from_session(session).get_by_id(json["id"])
        assert meter is not None
        assert meter.external_id is None

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_id_2027_01(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/meters/",
            json={
                "name": "Meter",
                "organization_id": str(organization.id),
                "external_id": "ext_1337",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            },
        )

        assert response.status_code == 201
        assert response.json()["external_id"] == "ext_1337"


@pytest.mark.asyncio
class TestUpdateMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/meters/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.api_version(V2026_04, V2026_10)
    @pytest.mark.auth
    async def test_external_id_ignored_before_2027_01(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="ext_1337"
        )
        meter = await create_meter(
            save_fixture, id=uuid.uuid4(), organization=organization
        )

        response = await client.patch(
            f"/v1/meters/{meter.id}", json={"external_id": "ext_1337"}
        )

        assert response.status_code == 200
        assert "external_id" not in response.json()
        updated_meter = await MeterRepository.from_session(session).get_by_id(meter.id)
        assert updated_meter is not None
        assert updated_meter.external_id is None

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_id_2027_01(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        meter = await create_meter(save_fixture, organization=organization)

        response = await client.patch(
            f"/v1/meters/{meter.id}", json={"external_id": "ext_1337"}
        )

        assert response.status_code == 200
        assert response.json()["external_id"] == "ext_1337"

    @pytest.mark.auth
    async def test_user_cannot_update_other_organization_meter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        meter_organization_second: Meter,
    ) -> None:
        response = await client.patch(
            f"/v1/meters/{meter_organization_second.id}",
            json={"name": "Updated"},
        )

        assert response.status_code == 404
