from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from httpx import AsyncClient

from polar.enums import SubscriptionRecurringInterval
from polar.models import (
    Customer,
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


def _seats(external_id: str, *unit_amounts: int) -> dict[str, Any]:
    bounds = [10 * (i + 1) for i in range(len(unit_amounts) - 1)] + [None]
    tiers = [{"bound": b, "unit_amount": a} for b, a in zip(bounds, unit_amounts)]
    return {
        **_product(external_id),
        "prices": [
            {
                "amount_type": "seat_based",
                "price_currency": "usd",
                "tiers": {"type": "volume", "tiers": tiers},
            }
        ],
    }


def _item(
    price: ProductPrice,
    amount: int,
    start: datetime | None = SEP_1,
    end: datetime | None = OCT_1,
    proration: bool = False,
) -> OrderItem:
    return OrderItem(
        label="",
        amount=amount,
        net_amount=amount,
        tax_amount=0,
        proration=proration,
        product_price=price,
        start_timestamp=start,
        end_timestamp=end,
    )


async def _bill(
    save_fixture: SaveFixture,
    subscription: Subscription,
    *items: OrderItem,
    created_at: datetime = SEP_1,
    status: OrderStatus = OrderStatus.paid,
) -> None:
    await create_order(
        save_fixture,
        customer=subscription.customer,
        subscription=subscription,
        order_items=list(items),
        created_at=created_at,
        status=status,
        currency=subscription.currency,
    )


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
    @pytest.mark.parametrize(
        "window",
        [
            {"since": OCT_1.isoformat(), "until": OCT_1.isoformat()},
            {"since": "2024-09-01T00:00:00Z", "until": OCT_1.isoformat()},
        ],
    )
    async def test_invalid_window(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        window: dict[str, str],
    ) -> None:
        response = await client.post(
            "/v1/config/simulate",
            params=window,
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

        async def subscribe(**kwargs: Any) -> Subscription:
            return await create_subscription(
                save_fixture, product=product, customer=customer, **kwargs
            )

        full_month = await subscribe(status=SubscriptionStatus.active)
        await _bill(save_fixture, full_month, _item(current, 1500))
        await _bill(
            save_fixture,
            full_month,
            _item(current, 1500),
            status=OrderStatus.void,
        )
        churned = await subscribe(revoke=True)
        await _bill(
            save_fixture, churned, _item(current, 1500), status=OrderStatus.refunded
        )
        # No period: falls back to one month from the order, Aug 16 – Sep 16.
        no_timestamps = await subscribe(
            prices=[archived], status=SubscriptionStatus.active
        )
        await _bill(
            save_fixture,
            no_timestamps,
            _item(archived, 1000, start=None, end=None),
            created_at=datetime(2026, 8, 16, tzinfo=UTC),
        )
        upgraded = await subscribe(status=SubscriptionStatus.active)
        await _bill(save_fixture, upgraded, _item(archived, 1000))
        mid_month = datetime(2026, 9, 16, tzinfo=UTC)
        await _bill(
            save_fixture,
            upgraded,
            _item(archived, -500, start=mid_month, proration=True),
            _item(current, 750, start=mid_month, proration=True),
            created_at=mid_month,
        )
        await subscribe(status=SubscriptionStatus.trialing)

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
            for c in result["cohorts"]
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
        await _bill(
            save_fixture,
            subscription,
            _item(
                product.prices[0],
                12000,
                start=march,
                end=datetime(2027, 3, 1, tzinfo=UTC),
            ),
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
        [cohort] = result["cohorts"]
        assert cohort["recurring_interval"] == "year"

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

        async def product(external_id: str, *prices: Any) -> Any:
            return await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=list(prices),
                external_id=external_id,
            )

        async def billed(product: Any, *amounts: int, **kwargs: Any) -> None:
            subscription = await create_subscription(
                save_fixture,
                product=product,
                customer=customer,
                status=SubscriptionStatus.active,
                **kwargs,
            )
            prices = [
                price
                for price in product.prices
                if price.price_currency == subscription.currency
            ]
            await _bill(
                save_fixture,
                subscription,
                *(_item(price, amount) for price, amount in zip(prices, amounts)),
            )

        await billed(
            await product("pro", (1500, "usd"), (1400, "eur")), 1400, currency="eur"
        )
        await billed(await product("team", ("seat", 1000, "usd")), 3000, seats=3)
        await billed(await product("crew", ("seat", 1000, "usd")), 3000, seats=3)
        await billed(
            await product("api", (1500, "usd"), (meter, Decimal(1), None, "usd")),
            1500,
            300,
        )
        await billed(await product("solo", (900, "usd")), 900)

        response = await client.post(
            "/v1/config/simulate",
            params=WINDOW,
            json={
                "organization_id": str(organization.id),
                "products": [
                    _product("pro", price_amount=2000),
                    _seats("team", 2000),
                    _seats("crew", 1000, 800),
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
        assert results["eur"]["cohorts"] == []
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
            for c in usd["cohorts"]
        ) == [
            ("api", "$15.00", True, 1500, 1500),
            ("team", "$10.00 per seat", False, 3000, 6000),
        ]
        assert usd["counts"] == {
            "more": 1,
            "less": 0,
            "same": 1,
            "no_history": 0,
            "not_simulated": 2,
        }
        assert sorted(
            (item["external_id"], item["reason"], item["subscribers"])
            for item in usd["not_simulated"]
        ) == [
            ("api", "metered unit prices aren't supported yet", 1),
            ("crew", "tiered seat prices aren't supported yet", 1),
            ("solo", "recurring interval changes aren't simulated", 1),
        ]
