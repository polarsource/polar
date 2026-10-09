import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.kit.utils import utc_now
from polar.meter.unit import MeterUnit
from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import METER_TEST_EVENT, create_event, create_meter

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


@pytest.mark.anyio
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
            "changes": [
                {
                    "resource": "meter",
                    "external_id": "sdk-tool-calls",
                    "action": "created",
                }
            ],
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

    @pytest.mark.parametrize(
        "price",
        [
            pytest.param(
                {
                    "amount_type": "metered_unit",
                    "meter": "sdk-tool-calls",
                    "unit_amount": "0.5",
                },
                id="metered_unit",
            ),
            pytest.param(
                {
                    "amount_type": "metered_tiers",
                    "meter": "sdk-tool-calls",
                    "tiers": {
                        "type": "graduated",
                        "tiers": [{"bound": None, "unit_amount": "0.5"}],
                    },
                },
                id="metered_tiers",
            ),
        ],
    )
    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_one_time_product_metered_price(
        self,
        price: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "meters": [METER],
                "products": [
                    {
                        "external_id": "pack",
                        "name": "Pack",
                        "prices": [price],
                    }
                ],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "products", 0]

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


@pytest.mark.anyio
class TestPlan:
    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_empty_config(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/plan", json={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        assert response.json() == {"changes": [], "issues": []}

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_locked_meter_reports_issues(
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
        assert [change["action"] for change in json["changes"]] == ["updated"]
        assert [(issue["severity"], issue["type"]) for issue in json["issues"]] == [
            ("error", "meter_locked"),
            ("warning", "unknown_event"),
        ]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_diff_for_updated_and_created_meters(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )
        renamed_meter = {
            "external_id": "my-meter",
            "name": "Renamed",
            "filter": {
                "conjunction": "and",
                "clauses": [
                    {"property": "name", "operator": "eq", "value": METER_TEST_EVENT}
                ],
            },
            "aggregation": {"func": "count"},
        }

        response = await client.post(
            "/v1/config/plan",
            json={
                "meters": [renamed_meter, METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 200
        updated, created = response.json()["changes"]
        assert updated["diff"] == [
            {"field": "name", "before": "My Meter", "after": "Renamed"}
        ]
        assert created["action"] == "created"
        assert {
            "field": "name",
            "before": None,
            "after": "SDK - Tool Calls",
        } in created["diff"]


@pytest.mark.anyio
class TestExport:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/config/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_enabled(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            "/v1/config/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 403
        assert response.json()["error"] == "ConfigAsCodeNotEnabled"

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_round_trips_through_plan(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="my-meter",
        )
        meter.user_metadata = {"team": "billing", "weight": 1.5}
        meter.unit = MeterUnit.custom
        meter.custom_label = "call"
        meter.custom_multiplier = 1000
        await save_fixture(meter)
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="Other Meter",
            external_id="other-meter",
        )

        response = await client.get(
            "/v1/config/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["skipped"] == []
        first, second = json["config"]["meters"]
        assert first == {
            "external_id": "my-meter",
            "name": "My Meter",
            "unit": "custom",
            "custom_label": "call",
            "custom_multiplier": 1000,
            "filter": {
                "conjunction": "and",
                "clauses": [
                    {"property": "name", "operator": "eq", "value": METER_TEST_EVENT}
                ],
            },
            "aggregation": {"func": "count"},
            "metadata": {"team": "billing", "weight": 1.5},
        }
        assert second["external_id"] == "other-meter"

        plan_response = await client.post(
            "/v1/config/plan",
            json={**json["config"], "organization_id": str(organization.id)},
        )

        assert plan_response.status_code == 200
        plan = plan_response.json()
        assert [change["action"] for change in plan["changes"]] == [
            "unchanged",
            "unchanged",
        ]
        assert all(issue["severity"] != "error" for issue in plan["issues"])

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_skipped_meters(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        without_external_id = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4()
        )
        archived = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="archived-meter",
        )
        archived.archived_at = utc_now()
        await save_fixture(archived)
        invalid = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="invalid-meter",
        )
        invalid.unit = MeterUnit.custom
        await save_fixture(invalid)

        response = await client.get(
            "/v1/config/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["config"] == {"meters": []}
        assert json["skipped"] == [
            {
                "resource": "meter",
                "id": str(without_external_id.id),
                "name": "My Meter",
                "reason": "missing_external_id",
            },
            {
                "resource": "meter",
                "id": str(archived.id),
                "name": "My Meter",
                "reason": "archived",
            },
            {
                "resource": "meter",
                "id": str(invalid.id),
                "name": "My Meter",
                "reason": "invalid",
            },
        ]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_meters_over_limit(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        mocker.patch("polar.declarative_config.service.MAXIMUM_METERS", 1)
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="first-meter",
        )
        second = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="second-meter",
        )

        response = await client.get(
            "/v1/config/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert [meter["external_id"] for meter in json["config"]["meters"]] == [
            "first-meter"
        ]
        assert json["skipped"] == [
            {
                "resource": "meter",
                "id": str(second.id),
                "name": "My Meter",
                "reason": "over_limit",
            }
        ]

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_organization_token(
        self, save_fixture: SaveFixture, client: AsyncClient, organization: Organization
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )

        response = await client.get("/v1/config/")

        assert response.status_code == 200
        [meter] = response.json()["config"]["meters"]
        assert meter["external_id"] == "my-meter"
