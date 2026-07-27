import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from polar.models import (
    BillingEntry,
    Customer,
    Organization,
    Product,
    Subscription,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_product,
)


@pytest.mark.asyncio
class TestPreviewChange:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/subscriptions/{uuid.uuid4()}/change-preview",
            json={"product_id": str(uuid.uuid4())},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_found(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/subscriptions/{uuid.uuid4()}/change-preview",
            json={"product_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_product_change(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=product.recurring_interval,
            prices=[(5000, "usd")],
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription.id}/change-preview",
            json={
                "product_id": str(new_product.id),
                "proration_behavior": "prorate",
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["prorations"]) == 2
        assert json["total_amount"] == json["proration_amount"]

    @pytest.mark.auth
    async def test_canceled_subscription_is_forbidden(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_canceled_subscription(
            save_fixture, product=product, customer=customer
        )
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=product.recurring_interval,
            prices=[(5000, "usd")],
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription.id}/change-preview",
            json={"product_id": str(new_product.id)},
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_seats_change_on_non_seat_subscription(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription.id}/change-preview",
            json={"seats": 5},
        )

        assert response.status_code == 400

    @pytest.mark.auth
    async def test_rejects_both_product_and_seats(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription.id}/change-preview",
            json={"product_id": str(product.id), "seats": 5},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_nothing_is_persisted(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_id = subscription.id
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=product.recurring_interval,
            prices=[(5000, "usd")],
        )

        response = await client.post(
            f"/v1/subscriptions/{subscription.id}/change-preview",
            json={"product_id": str(new_product.id), "proration_behavior": "prorate"},
        )

        assert response.status_code == 200

        assert (
            await session.scalar(
                select(Subscription.product_id).where(
                    Subscription.id == subscription_id
                )
            )
            == product.id
        )
        assert await session.scalar(select(func.count()).select_from(BillingEntry)) == 0
