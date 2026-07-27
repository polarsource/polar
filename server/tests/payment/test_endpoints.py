import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Customer, Organization, Payment, Product, UserOrganization
from polar.models.payment import PaymentTrigger
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_order, create_payment


@pytest_asyncio.fixture
async def payment_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Payment:
    return await create_payment(save_fixture, organization_second)


@pytest.mark.asyncio
class TestListPayments:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/payments/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_payments(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payment_organization_second: Payment,
    ) -> None:
        response = await client.get("/v1/payments/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth
    async def test_filter_by_customer_id(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        order_second = await create_order(save_fixture, customer=customer_second)
        payment = await create_payment(save_fixture, organization, order=order)
        await create_payment(save_fixture, organization, order=order_second)

        response = await client.get(
            "/v1/payments/", params={"customer_id": str(customer.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(payment.id)

    @pytest.mark.auth
    async def test_filter_by_customer_id_includes_checkout_payments_without_order(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], customer=customer
        )
        failed_checkout_payment = await create_payment(
            save_fixture, organization, checkout=checkout, order=None
        )

        response = await client.get(
            "/v1/payments/", params={"customer_id": str(customer.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(failed_checkout_payment.id)


@pytest.mark.asyncio
class TestGetPayment:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/payments/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_payment(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        payment_organization_second: Payment,
    ) -> None:
        response = await client.get(f"/v1/payments/{payment_organization_second.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.payments_read}),
    )
    async def test_trigger(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            organization,
            order=order,
            trigger=PaymentTrigger.retry_dunning,
        )

        response = await client.get(f"/v1/payments/{payment.id}")

        assert response.status_code == 200
        assert response.json()["trigger"] == PaymentTrigger.retry_dunning
