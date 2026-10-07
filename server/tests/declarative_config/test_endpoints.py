import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event, create_meter

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
        response = await client.post("/v1/config/apply", json={"meters": [METER]})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_enabled(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "ConfigAsCodeNotEnabled"

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_valid(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")

        response = await client.post(
            "/v1/config/apply",
            json={
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "meters": [{"external_id": "sdk-tool-calls", "action": "created"}],
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_organization_token(
        self, mocker: MockerFixture, client: AsyncClient
    ) -> None:
        mocker.patch("polar.meter.service.enqueue_job")

        response = await client.post("/v1/config/apply", json={"meters": [METER]})

        assert response.status_code == 200

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unknown_key(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "meters": [{**METER, "agregation": {"func": "count"}}],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "meters", 0, "agregation"]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_duplicate_external_ids(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "meters": [METER, {**METER, "name": "Duplicate"}],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 409
        json = response.json()
        assert json["error"] == "ConfigInvalid"
        [error] = json["detail"]
        assert error["type"] == "duplicate_external_id"
        assert error["loc"] == ["body", "meters", 1, "external_id"]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_aggregating_meter_locked_fields(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="sdk-tool-calls",
            last_billed_event=event,
        )

        response = await client.post(
            "/v1/config/apply",
            json={"meters": [METER], "organization_id": str(organization.id)},
        )

        assert response.status_code == 409
        json = response.json()
        assert json["error"] == "ConfigInvalid"
        assert json["detail"] == [
            {
                "severity": "error",
                "type": "meter_locked",
                "loc": ["body", "meters", 0, "filter"],
                "msg": (
                    "This field can't be updated because the meter "
                    "is already aggregating events."
                ),
                "input": None,
            }
        ]


@pytest.mark.asyncio
class TestPlan:
    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="sdk-tool-calls",
            last_billed_event=event,
        )

        response = await client.post(
            "/v1/config/plan",
            json={"meters": [METER], "organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["changes"] == [
            {"external_id": "sdk-tool-calls", "action": "updated"}
        ]
        assert [(issue["severity"], issue["type"]) for issue in json["issues"]] == [
            ("error", "meter_locked"),
            ("warning", "unknown_event"),
        ]
