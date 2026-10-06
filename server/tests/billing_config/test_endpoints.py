import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Organization, UserOrganization

METER = {
    "external_id": "sdk-tool-calls",
    "name": "SDK - Tool Calls",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": "tool_call"}],
    },
    "aggregation": {"func": "count"},
    "unit": "custom",
    "custom_label": "call",
}


@pytest.mark.asyncio
class TestApply:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/billing-config/apply", json={"version": 1, "meters": [METER]}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_enabled(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/billing-config/apply",
            json={
                "version": 1,
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_valid(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")

        response = await client.post(
            "/v1/billing-config/apply",
            json={
                "version": 1,
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["version"] == 1
        [meter_result] = json["meters"]
        assert meter_result["external_id"] == "sdk-tool-calls"
        assert meter_result["action"] == "created"
        assert meter_result["meter"]["name"] == "SDK - Tool Calls"

    @pytest.mark.auth
    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_duplicate_external_ids(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/billing-config/apply",
            json={
                "version": 1,
                "meters": [METER, {**METER, "name": "Duplicate"}],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "meters"]

    @pytest.mark.auth
    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_unsupported_version(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/billing-config/apply",
            json={
                "version": 2,
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "version"]
