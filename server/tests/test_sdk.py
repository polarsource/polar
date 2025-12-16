from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from polar_sdk import Polar

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import Benefit, Customer, Organization, Product, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_order,
    create_subscription,
)


@pytest_asyncio.fixture
async def polar(app: FastAPI) -> AsyncGenerator[Polar]:
    async with AsyncClient(transport=ASGITransport(app=app)) as client:
        yield Polar(access_token="", async_client=client)


@pytest.mark.asyncio
@pytest.mark.auth
class TestSDK:
    """
    Those tests are here to ensure we do not introduce changes to the API that would break the SDK.

    Basically, we just run queries against our ASGI app to see if the SDK is able to parse the response without errors.
    """

    async def test_get_organization(
        self,
        polar: Polar,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await polar.organizations.get_async(id=str(organization.id))
        assert response is not None

    async def test_list_products(
        self,
        polar: Polar,
        product: Product,
        product_second: Product,
        user_organization: UserOrganization,
    ) -> None:
        products = [product, product_second]

        response = await polar.products.list_async()
        assert response is not None

        assert len(response.result.items) == len(products)

    async def test_list_benefits(
        self, polar: Polar, benefits: list[Benefit], user_organization: UserOrganization
    ) -> None:
        response = await polar.benefits.list_async()
        assert response is not None

        assert len(response.result.items) == len(benefits)

    async def test_list_orders(
        self,
        save_fixture: SaveFixture,
        polar: Polar,
        product: Product,
        product_one_time: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        orders = [
            await create_order(
                save_fixture,
                product=product_one_time,
                customer=customer,
            ),
            await create_order(
                save_fixture,
                product=product,
                customer=customer,
                subscription=subscription,
            ),
        ]

        response = await polar.orders.list_async()
        assert response is not None

        assert len(response.result.items) == len(orders)

    async def test_list_subscriptions(
        self,
        save_fixture: SaveFixture,
        polar: Polar,
        product: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        subscriptions = [
            await create_subscription(
                save_fixture, product=product, customer=customer, started_at=utc_now()
            ),
            await create_subscription(
                save_fixture, product=product, customer=customer, started_at=utc_now()
            ),
        ]

        response = await polar.subscriptions.list_async()
        assert response is not None

        assert len(response.result.items) == len(subscriptions)

    async def test_cancel_subscription(
        self,
        save_fixture: SaveFixture,
        polar: Polar,
        product: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        response = await polar.subscriptions.update_async(
            id=str(subscription.id),
            subscription_update={"cancel_at_period_end": True},
        )

        assert response is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", scopes={Scope.checkouts_write})
    )
    async def test_create_checkout(
        self,
        save_fixture: SaveFixture,
        polar: Polar,
        product: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        response = await polar.checkouts.create_async(
            request={
                "products": [str(product.id)],
                "external_customer_id": "EXTERNAL_CUSTOMER_ID",
            }
        )
        assert response is not None

        assert response.product_id == str(product.id)
        assert response.external_customer_id == "EXTERNAL_CUSTOMER_ID"

    async def test_create_checkout_link(
        self,
        save_fixture: SaveFixture,
        polar: Polar,
        product: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        response = await polar.checkout_links.create_async(
            request={
                "payment_processor": "stripe",
                "product_id": str(product.id),
            }
        )
        assert response is not None

        assert len(response.products) == 1

    async def test_client_get_checkout(
        self,
        save_fixture: SaveFixture,
        polar: Polar,
        product: Product,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        checkout = await create_checkout(save_fixture, products=[product])
        response = await polar.checkouts.client_get_async(
            client_secret=checkout.client_secret
        )
        assert response is not None

        assert response.product_id == str(product.id)
