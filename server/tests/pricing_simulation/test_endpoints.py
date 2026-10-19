from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.models import Customer, Organization, UserOrganization
from polar.models.subscription import SubscriptionStatus
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_meter,
    create_product,
    create_product_price_fixed,
    create_subscription,
)


def _product(external_id: str, interval: str = "month", **price: Any) -> dict[str, Any]:
    return {
        "external_id": external_id,
        "name": external_id.title(),
        "recurring_interval": interval,
        "prices": [{"amount_type": "fixed", "price_currency": "usd", **price}],
    }


@pytest.mark.anyio
class TestSimulate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post("/v1/config/simulate", json={})

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_enabled(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/simulate", json={"organization_id": str(organization.id)}
        )

        assert response.status_code == 403
        assert response.json()["error"] == "ConfigAsCodeNotEnabled"

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_cohorts(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1500, "usd")],
            external_id="pro",
        )
        archived = await create_product_price_fixed(
            save_fixture, product=product, amount=1000, is_archived=True
        )
        for status in (SubscriptionStatus.active, SubscriptionStatus.past_due):
            await create_subscription(
                save_fixture, product=product, customer=customer, status=status
            )
        await create_subscription(
            save_fixture,
            product=product,
            prices=[archived],
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
            cancel_at_period_end=True,
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
        )

        response = await client.post(
            "/v1/config/simulate",
            json={
                "organization_id": str(organization.id),
                "products": [_product("pro", price_amount=2000)],
            },
        )

        assert response.status_code == 200
        [result] = response.json()
        assert result["monthly_delta"] == 2 * 500 + 1000
        assert result["counts"] == {"more": 3, "less": 0, "same": 0, "no_history": 1}
        assert sorted(
            (
                c["price_label"],
                c["subscribers"],
                c["baseline_monthly"],
                c["proposed_monthly"],
            )
            for c in result["cohorts"]
        ) == [("$10.00", 1, 1000, 2000), ("$15.00", 2, 3000, 4000)]
        assert result["not_simulated"] == []

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_yearly_normalized_to_month(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
            prices=[(12000, "usd")],
            external_id="pro-yearly",
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        response = await client.post(
            "/v1/config/simulate",
            json={
                "organization_id": str(organization.id),
                "products": [_product("pro-yearly", "year", price_amount=6000)],
            },
        )

        assert response.status_code == 200
        [result] = response.json()
        assert result["monthly_delta"] == -500
        assert result["counts"]["less"] == 1
        [cohort] = result["cohorts"]
        assert (cohort["baseline_monthly"], cohort["proposed_monthly"]) == (1000, 500)

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_not_simulated(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="tokens"
        )
        multi_currency = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1500, "usd"), (1400, "eur")],
            external_id="pro",
        )
        seats = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
            external_id="team",
        )
        metered = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1500, "usd"), (meter, Decimal(1), None, "usd")],
            external_id="api",
        )
        await create_subscription(
            save_fixture,
            product=multi_currency,
            currency="eur",
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await create_subscription(
            save_fixture,
            product=seats,
            customer=customer,
            status=SubscriptionStatus.active,
            seats=3,
        )
        await create_subscription(
            save_fixture,
            product=metered,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        response = await client.post(
            "/v1/config/simulate",
            json={
                "organization_id": str(organization.id),
                "products": [
                    _product("pro", price_amount=2000),
                    {
                        **_product("team"),
                        "prices": [
                            {
                                "amount_type": "seat_based",
                                "price_currency": "usd",
                                "tiers": {
                                    "type": "volume",
                                    "tiers": [{"bound": None, "unit_amount": 2000}],
                                },
                            }
                        ],
                    },
                    {
                        **_product("api", price_amount=1500),
                        "prices": [
                            {
                                "amount_type": "fixed",
                                "price_currency": "usd",
                                "price_amount": 1500,
                            },
                            {
                                "amount_type": "metered_unit",
                                "price_currency": "usd",
                                "meter": "tokens",
                                "unit_amount": "2",
                            },
                        ],
                    },
                ],
            },
        )

        assert response.status_code == 200, response.text
        results = {result["currency"]: result for result in response.json()}
        assert results["eur"]["cohorts"] == []
        assert results["eur"]["not_simulated"] == [
            {
                "resource": "product",
                "external_id": "pro",
                "reason": "The config has no fixed EUR price.",
            }
        ]
        usd = results["usd"]
        [cohort] = usd["cohorts"]
        assert cohort["product_external_id"] == "api"
        assert usd["counts"] == {"more": 0, "less": 0, "same": 1, "no_history": 0}
        assert sorted(
            (item["external_id"], item["reason"]) for item in usd["not_simulated"]
        ) == [
            ("api", "metered unit prices aren't supported yet."),
            ("team", "seat based prices aren't supported yet."),
        ]
