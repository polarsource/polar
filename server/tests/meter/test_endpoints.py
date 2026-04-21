import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import Meter, Organization, UserOrganization
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


@pytest.mark.asyncio
class TestCreateMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/meters/")

        assert response.status_code == 401


@pytest.mark.asyncio
class TestUpdateMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/meters/{uuid.uuid4()}")

        assert response.status_code == 401

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
