import uuid
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.kit.visibility import Visibility
from polar.meter.unit import MeterUnit
from polar.models import Organization, UserOrganization
from polar.models.benefit import BenefitType
from polar.models.custom_field import CustomFieldType
from polar.product.tiers import Tier, Tiers, TierType
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_benefit,
    create_custom_field,
    create_event,
    create_meter,
    create_product,
    create_product_price_metered_tiers,
    create_product_price_seat_unit,
    set_product_benefits,
)

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

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    @pytest.mark.parametrize(
        "fields",
        [
            {
                "prices": [
                    {
                        "amount_type": "metered_unit",
                        "meter": "sdk-tool-calls",
                        "unit_amount": "0.5",
                    }
                ]
            },
            {"trial_interval": "day", "trial_interval_count": 7},
            {"meter_interval": "month"},
            {"meter_interval_count": 2},
        ],
    )
    async def test_one_time_product_recurring_fields(
        self,
        fields: dict[str, Any],
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
                        "prices": [{"amount_type": "fixed", "price_amount": 1000}],
                        **fields,
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
        assert json["config"] == {"meters": [], "benefits": [], "products": []}
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
        mocker.patch("polar.declarative_config.schemas.MAXIMUM_METERS", 1)
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

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_benefits_and_products_round_trip_through_plan(
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
            external_id="api-calls",
        )
        credits = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            description="API credits",
            properties={"meter_id": str(meter.id), "units": 1000, "rollover": True},
            external_id="api-credits",
        )
        beta = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            description="Beta access",
            properties={},
            external_id="beta",
        )
        support = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.custom,
            description="Priority support",
            properties={"note": "Email us"},
            external_id="support",
            visibility=Visibility.private,
        )
        await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
            description="License key",
            properties={
                "prefix": "PRO",
                "expires": {"ttl": 1, "timeframe": "year"},
                "activations": {"limit": 3, "enable_customer_admin": True},
                "limit_usage": None,
            },
            external_id="license",
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Pro",
            prices=[(2000, "usd"), (meter, Decimal("0.5"), 5000, "usd")],
            trial_interval=TrialInterval.day,
            trial_interval_count=7,
            meter_interval=SubscriptionRecurringInterval.month,
            external_id="pro",
        )
        await set_product_benefits(
            save_fixture, product=product, benefits=[beta, credits, support]
        )
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Pay what you want",
            prices=[(500, 5000, 1000, "usd")],
            external_id="pwyw",
        )
        company = await create_custom_field(
            save_fixture,
            type=CustomFieldType.text,
            slug="company",
            organization=organization,
        )
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Team",
            prices=[("seat", 1000, "usd")],
            attached_custom_fields=[(company, True)],
            external_id="team",
        )
        usage = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Usage",
            prices=[],
            external_id="usage",
        )
        usage.prices.append(
            await create_product_price_metered_tiers(
                save_fixture,
                product=usage,
                meter=meter,
                tiers=Tiers(
                    type=TierType.graduated,
                    tiers=[
                        Tier(bound=100, unit_amount=Decimal(10)),
                        Tier(unit_amount=Decimal(5)),
                    ],
                ),
            )
        )

        response = await client.get(
            "/v1/config/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["skipped"] == []
        assert json["config"]["benefits"] == [
            {
                "external_id": "api-credits",
                "type": "meter_credit",
                "description": "API credits",
                "visibility": "public",
                "properties": {"meter": "api-calls", "units": 1000, "rollover": True},
                "metadata": {},
            },
            {
                "external_id": "beta",
                "type": "feature_flag",
                "description": "Beta access",
                "visibility": "public",
                "metadata": {},
            },
            {
                "external_id": "support",
                "type": "custom",
                "description": "Priority support",
                "visibility": "private",
                "properties": {"note": "Email us"},
                "metadata": {},
            },
            {
                "external_id": "license",
                "type": "license_keys",
                "description": "License key",
                "visibility": "public",
                "properties": {
                    "prefix": "PRO",
                    "expires": {"ttl": 1, "timeframe": "year"},
                    "activations": {"limit": 3, "enable_customer_admin": True},
                    "limit_usage": None,
                },
                "metadata": {},
            },
        ]
        exported_product, pwyw, team, usage_product = json["config"]["products"]
        [metered_tiers] = usage_product["prices"]
        assert (metered_tiers["amount_type"], metered_tiers["meter"]) == (
            "metered_tiers",
            "api-calls",
        )
        assert pwyw["prices"] == [
            {
                "amount_type": "custom",
                "price_currency": "usd",
                "tax_behavior": None,
                "minimum_amount": 500,
                "maximum_amount": 5000,
                "preset_amount": 1000,
            }
        ]
        assert team["custom_fields"] == [{"slug": "company", "required": True}]
        [seat_price] = team["prices"]
        assert (seat_price["amount_type"], seat_price["minimum_units"]) == (
            "seat_based",
            1,
        )
        fixed_price, metered_price = exported_product["prices"]
        assert {
            key: value for key, value in exported_product.items() if key != "prices"
        } == {
            "external_id": "pro",
            "name": "Pro",
            "description": "Description",
            "visibility": "public",
            "recurring_interval": "month",
            "recurring_interval_count": 1,
            "trial_interval": "day",
            "trial_interval_count": 7,
            "meter_interval": "month",
            "meter_interval_count": 1,
            "benefits": ["beta", "api-credits", "support"],
            "custom_fields": [],
            "metadata": {},
        }
        assert fixed_price == {
            "amount_type": "fixed",
            "price_currency": "usd",
            "tax_behavior": None,
            "price_amount": 2000,
        }
        assert Decimal(metered_price["unit_amount"]) == Decimal("0.5")
        assert {
            key: value for key, value in metered_price.items() if key != "unit_amount"
        } == {
            "amount_type": "metered_unit",
            "price_currency": "usd",
            "tax_behavior": None,
            "meter": "api-calls",
            "cap_amount": 5000,
        }

        plan_response = await client.post(
            "/v1/config/plan",
            json={**json["config"], "organization_id": str(organization.id)},
        )

        assert plan_response.status_code == 200
        plan = plan_response.json()
        assert [
            (change["resource"], change["action"]) for change in plan["changes"]
        ] == [
            ("meter", "unchanged"),
            ("benefit", "unchanged"),
            ("benefit", "unchanged"),
            ("benefit", "unchanged"),
            ("benefit", "unchanged"),
            ("product", "unchanged"),
            ("product", "unchanged"),
            ("product", "unchanged"),
            ("product", "unchanged"),
        ]
        assert all(issue["severity"] != "error" for issue in plan["issues"])

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_skipped_and_partial_products(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, id=uuid.uuid4()
        )
        without_external_id = await create_benefit(
            save_fixture, organization=organization, description="No external ID"
        )
        downloadables = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.downloadables,
            description="Downloads",
            properties={"archived": {}, "files": []},
            external_id="downloads",
        )
        unknown_meter = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            description="Credits",
            properties={"meter_id": str(meter.id), "units": 10, "rollover": False},
            external_id="credits",
        )
        archived = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Archived",
            is_archived=True,
            external_id="archived",
        )
        bounded_seats = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Bounded seats",
            prices=[],
            external_id="bounded-seats",
        )
        bounded_seats.prices.append(
            await create_product_price_seat_unit(
                save_fixture, product=bounded_seats, maximum_seats=10
            )
        )
        partial = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Partial",
            external_id="partial",
        )
        partial.prices.append(
            await create_product_price_seat_unit(
                save_fixture, product=partial, maximum_seats=10
            )
        )
        await set_product_benefits(
            save_fixture, product=partial, benefits=[downloadables]
        )

        response = await client.get(
            "/v1/config/", params={"organization_id": str(organization.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert (json["config"]["meters"], json["config"]["benefits"]) == ([], [])
        [exported_partial] = json["config"]["products"]
        assert exported_partial["external_id"] == "partial"
        assert [price["amount_type"] for price in exported_partial["prices"]] == [
            "fixed"
        ]
        assert exported_partial["benefits"] == []
        assert [
            (skipped["resource"], skipped["id"], skipped["reason"])
            for skipped in json["skipped"]
        ] == [
            ("meter", str(meter.id), "missing_external_id"),
            ("benefit", str(without_external_id.id), "missing_external_id"),
            ("benefit", str(downloadables.id), "not_supported"),
            ("benefit", str(unknown_meter.id), "unknown_reference"),
            ("product", str(archived.id), "archived"),
            ("product", str(bounded_seats.id), "not_supported"),
        ]

        plan_response = await client.post(
            "/v1/config/plan",
            json={**json["config"], "organization_id": str(organization.id)},
        )

        plan = plan_response.json()
        assert [change["action"] for change in plan["changes"]] == ["unchanged"]
        assert [(issue["severity"], issue["loc"]) for issue in plan["issues"]] == [
            ("warning", ["body", "products", 0, "prices"]),
            ("warning", ["body", "products", 0, "benefits"]),
        ]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_read})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_sections_require_scopes(
        self, save_fixture: SaveFixture, client: AsyncClient, organization: Organization
    ) -> None:
        await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={},
            external_id="beta",
        )
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            external_id="pack",
        )

        response = await client.get("/v1/config/")

        assert response.status_code == 200
        json = response.json()
        assert json["config"] == {"meters": [], "benefits": [], "products": []}
        assert json["skipped"] == []

        plan_response = await client.post("/v1/config/plan", json=json["config"])

        assert plan_response.status_code == 200
