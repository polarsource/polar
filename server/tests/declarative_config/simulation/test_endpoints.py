from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.models import (
    Customer,
    Order,
    OrderItem,
    Organization,
    ProductPrice,
    Subscription,
    UserOrganization,
)
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_meter,
    create_order,
    create_product,
    create_product_price_fixed,
    create_subscription,
)

SEP_1 = datetime(2026, 9, 1, tzinfo=UTC)
OCT_1 = datetime(2026, 10, 1, tzinfo=UTC)
WINDOW = {"since": SEP_1.isoformat(), "until": OCT_1.isoformat()}


def _product(external_id: str, interval: str = "month", **price: Any) -> dict[str, Any]:
    return {
        "external_id": external_id,
        "name": external_id.title(),
        "recurring_interval": interval,
        "prices": [{"amount_type": "fixed", "price_currency": "usd", **price}],
    }


@pytest.fixture
def bill(save_fixture: SaveFixture) -> Callable[..., Awaitable[Order]]:
    async def create(
        subscription: Subscription,
        *items: tuple[ProductPrice, int],
        start: datetime | None = SEP_1,
        end: datetime | None = OCT_1,
        proration: bool = False,
        created_at: datetime = SEP_1,
        status: OrderStatus = OrderStatus.paid,
    ) -> Order:
        return await create_order(
            save_fixture,
            customer=subscription.customer,
            subscription=subscription,
            order_items=[
                OrderItem(
                    label="",
                    amount=amount,
                    net_amount=amount,
                    tax_amount=0,
                    proration=proration,
                    product_price=price,
                    start_timestamp=start,
                    end_timestamp=end,
                )
                for price, amount in items
            ],
            created_at=created_at,
            status=status,
            currency=subscription.currency,
        )

    return create


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
    async def test_invalid_window(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/simulate",
            params={"since": "2024-09-01T00:00:00Z", "until": OCT_1.isoformat()},
            json={"organization_id": str(organization.id)},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_replay(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
        bill: Callable[..., Awaitable[Order]],
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1500, "usd")],
            external_id="pro",
        )
        [current] = product.prices
        archived = await create_product_price_fixed(
            save_fixture, product=product, amount=1000, is_archived=True
        )

        full_month = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await bill(full_month, (current, 1500))
        await bill(full_month, (current, 1500), status=OrderStatus.void)
        churned = await create_subscription(
            save_fixture, product=product, customer=customer, revoke=True
        )
        await bill(churned, (current, 1500), status=OrderStatus.refunded)
        # No period: falls back to one month from the order, Aug 16 – Sep 16.
        no_timestamps = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            prices=[archived],
            status=SubscriptionStatus.active,
        )
        await bill(
            no_timestamps,
            (archived, 1000),
            start=None,
            end=None,
            created_at=datetime(2026, 8, 16, tzinfo=UTC),
        )
        upgraded = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await bill(upgraded, (archived, 1000))
        mid_month = datetime(2026, 9, 16, tzinfo=UTC)
        await bill(
            upgraded,
            (archived, -500),
            (current, 750),
            start=mid_month,
            proration=True,
            created_at=mid_month,
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
        )

        response = await client.post(
            "/v1/config/simulate",
            params=WINDOW,
            json={
                "organization_id": str(organization.id),
                "products": [_product("pro", price_amount=2000)],
            },
        )

        assert response.status_code == 200, response.text
        [result] = response.json()
        assert result["window"] == {
            "since": "2026-09-01T00:00:00Z",
            "until": "2026-10-01T00:00:00Z",
            "months": 1.0,
        }
        no_timestamps_share = Decimal(1000 * 15) / 31
        assert sorted(
            (
                c["price_label"],
                c["archived"],
                c["subscribers"],
                c["baseline"],
                c["proposed"],
            )
            for c in result["breakdown"]
        ) == [
            (
                "$10.00",
                True,
                2,
                round(no_timestamps_share + 500),
                round(2 * no_timestamps_share + 1000),
            ),
            ("$15.00", False, 3, 1500 + 1500 + 750, 2000 + 2000 + 1000),
        ]
        assert (result["baseline"], result["proposed"]) == (4734, 6968)
        assert result["monthly_delta"] == 6968 - 4734
        assert result["counts"] == {
            "more": 4,
            "less": 0,
            "same": 0,
            "no_history": 1,
            "not_simulated": 0,
        }
        assert result["not_simulated"] == [
            {
                "resource": "product",
                "external_id": "pro",
                "reason": "nothing billed in the window",
                "subscribers": 1,
            }
        ]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_yearly_order_before_window(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
        bill: Callable[..., Awaitable[Order]],
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
            prices=[(12000, "usd")],
            external_id="pro-yearly",
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        march = datetime(2026, 3, 1, tzinfo=UTC)
        await bill(
            subscription,
            (product.prices[0], 12000),
            start=march,
            end=datetime(2027, 3, 1, tzinfo=UTC),
            created_at=march,
        )

        response = await client.post(
            "/v1/config/simulate",
            params=WINDOW,
            json={
                "organization_id": str(organization.id),
                "products": [_product("pro-yearly", "year", price_amount=6000)],
            },
        )

        assert response.status_code == 200, response.text
        [result] = response.json()
        # September is 30 of the period's 365 days.
        assert (result["baseline"], result["proposed"]) == (986, 493)
        assert result["monthly_delta"] == -493
        assert result["counts"]["less"] == 1
        [item] = result["breakdown"]
        assert item["recurring_interval"] == "year"

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_not_simulated(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
        bill: Callable[..., Awaitable[Order]],
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="tokens"
        )

        pro = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1500, "usd"), (1400, "eur")],
            external_id="pro",
        )
        pro_subscription = await create_subscription(
            save_fixture,
            product=pro,
            customer=customer,
            status=SubscriptionStatus.active,
            currency="eur",
        )
        await bill(pro_subscription, (pro.prices[1], 1400))

        team = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[("seat", 1000, "usd")],
            external_id="team",
        )
        team_subscription = await create_subscription(
            save_fixture,
            product=team,
            customer=customer,
            status=SubscriptionStatus.active,
            seats=3,
        )
        await bill(team_subscription, (team.prices[0], 3000))

        api = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(1500, "usd"), (meter, Decimal(1), None, "usd")],
            external_id="api",
        )
        api_subscription = await create_subscription(
            save_fixture,
            product=api,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await bill(api_subscription, (api.prices[0], 1500), (api.prices[1], 300))

        solo = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(900, "usd")],
            external_id="solo",
        )
        solo_subscription = await create_subscription(
            save_fixture,
            product=solo,
            customer=customer,
            status=SubscriptionStatus.active,
        )
        await bill(solo_subscription, (solo.prices[0], 900))

        response = await client.post(
            "/v1/config/simulate",
            params=WINDOW,
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
                        **_product("api"),
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
                    _product("solo", "year", price_amount=9000),
                ],
            },
        )

        assert response.status_code == 200, response.text
        results = {result["currency"]: result for result in response.json()}
        assert results["eur"]["breakdown"] == []
        assert results["eur"]["not_simulated"] == [
            {
                "resource": "product",
                "external_id": "pro",
                "reason": "no fixed EUR price in the config",
                "subscribers": 1,
            }
        ]
        assert results["eur"]["counts"]["not_simulated"] == 1
        usd = results["usd"]
        assert sorted(
            (
                c["product_external_id"],
                c["price_label"],
                c["partial"],
                c["baseline"],
                c["proposed"],
            )
            for c in usd["breakdown"]
        ) == [
            ("api", "$15.00", True, 1500, 1500),
            ("team", "$10.00 per seat", False, 3000, 6000),
        ]
        assert usd["counts"] == {
            "more": 1,
            "less": 0,
            "same": 1,
            "no_history": 0,
            "not_simulated": 1,
        }
        assert sorted(
            (item["external_id"], item["reason"], item["subscribers"])
            for item in usd["not_simulated"]
        ) == [
            ("api", "metered unit prices aren't supported yet", 1),
            ("solo", "recurring interval changes aren't simulated", 1),
        ]
