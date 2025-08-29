import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Customer, Order, Organization, Product, UserOrganization
from polar.models.custom_field import CustomFieldType
from polar.models.subscription import SubscriptionRecurringInterval
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_custom_field,
    create_customer,
    create_order,
    create_product,
)


@pytest_asyncio.fixture
async def orders(
    save_fixture: SaveFixture, product: Product, customer: Customer
) -> list[Order]:
    return [await create_order(save_fixture, product=product, customer=customer)]


@pytest.mark.asyncio
class TestListOrders:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, orders: list[Order]
    ) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        response = await client.get("/v1/orders/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == len(orders)

    @pytest.mark.auth
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(
            save_fixture,
            stripe_invoice_id="INVOICE_ID_1",
            product=product,
            customer=customer,
            user_metadata={"reference_id": "ABC"},
        )
        await create_order(
            save_fixture,
            stripe_invoice_id="INVOICE_ID_2",
            product=product,
            customer=customer,
            user_metadata={"reference_id": "DEF"},
        )
        await create_order(
            save_fixture,
            stripe_invoice_id="INVOICE_ID_3",
            product=product,
            customer=customer,
            user_metadata={"reference_id": "GHI"},
        )

        response = await client.get(
            "/v1/orders/", params={"metadata[reference_id]": ["ABC", "DEF"]}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2


@pytest.mark.asyncio
class TestGetOrder:
    async def test_anonymous(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/orders/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, orders: list[Order]
    ) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(orders[0].id)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_read}),
    )
    async def test_organization(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.get(f"/v1/orders/{orders[0].id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(orders[0].id)

    @pytest.mark.auth
    async def test_custom_field(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            custom_field_data={"test": None},
        )

        response = await client.get(f"/v1/orders/{order.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["custom_field_data"] == {"test": None}


@pytest.mark.asyncio
class TestUpdateOrder:
    async def test_anonymous(self, client: AsyncClient, orders: list[Order]) -> None:
        response = await client.patch(
            f"/v1/orders/{orders[0].id}",
            json={"custom_field_data": {"test": "updated"}},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/orders/{uuid.uuid4()}",
            json={"custom_field_data": {"test": "updated"}},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, orders: list[Order]
    ) -> None:
        response = await client.patch(
            f"/v1/orders/{orders[0].id}",
            json={"custom_field_data": {"test": "updated"}},
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
        AuthSubjectFixture(scopes={Scope.orders_write}),
    )
    async def test_user_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # Create a product with custom fields
        text_field = await create_custom_field(
            save_fixture, type=CustomFieldType.text, slug="text", organization=organization
        )
        select_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.select,
            slug="select",
            organization=organization,
            properties={
                "options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}],
            },
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            attached_custom_fields=[(text_field, False), (select_field, True)],
        )

        # Create an order with custom field data
        order = await create_order(
            save_fixture,
            product=product,
            customer=await create_customer(save_fixture, organization=organization),
            custom_field_data={"text": "original", "select": "a"},
        )

        response = await client.patch(
            f"/v1/orders/{order.id}",
            json={"custom_field_data": {"text": "updated", "select": "b"}},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["custom_field_data"] == {"text": "updated", "select": "b"}

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_write}),
    )
    async def test_organization(
        self, save_fixture: SaveFixture, client: AsyncClient, organization: Organization
    ) -> None:
        # Create a product with custom fields
        text_field = await create_custom_field(
            save_fixture, type=CustomFieldType.text, slug="text", organization=organization
        )
        select_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.select,
            slug="select",
            organization=organization,
            properties={
                "options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}],
            },
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            attached_custom_fields=[(text_field, False), (select_field, True)],
        )

        # Create an order with custom field data
        order = await create_order(
            save_fixture,
            product=product,
            customer=await create_customer(save_fixture, organization=organization),
            custom_field_data={"text": "original", "select": "a"},
        )

        response = await client.patch(
            f"/v1/orders/{order.id}",
            json={"custom_field_data": {"text": "updated", "select": "b"}},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["custom_field_data"] == {"text": "updated", "select": "b"}

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
    )
    async def test_update_existing_custom_field_data(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # Create a product with custom fields
        text_field = await create_custom_field(
            save_fixture, type=CustomFieldType.text, slug="text", organization=organization
        )
        select_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.select,
            slug="select",
            organization=organization,
            properties={
                "options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}],
            },
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            attached_custom_fields=[(text_field, False), (select_field, True)],
        )

        # Create an order with custom field data
        order = await create_order(
            save_fixture,
            product=product,
            customer=await create_customer(save_fixture, organization=organization),
            custom_field_data={"text": "original", "select": "a"},
        )

        response = await client.patch(
            f"/v1/orders/{order.id}",
            json={"custom_field_data": {"text": "updated", "select": "b"}},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["custom_field_data"] == {"text": "updated", "select": "b"}

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
    )
    async def test_update_billing_name(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        response = await client.patch(
            f"/v1/orders/{orders[0].id}",
            json={"billing_name": "Updated Billing Name"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["billing_name"] == "Updated Billing Name"

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
    )
    async def test_update_billing_address(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        orders: list[Order],
    ) -> None:
        new_address = {
            "country": "US",
            "state": "CA",
            "line1": "123 Updated St",
            "city": "Updated City",
            "postal_code": "12345",
        }

        response = await client.patch(
            f"/v1/orders/{orders[0].id}",
            json={"billing_address": new_address},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["billing_address"]["line1"] == "123 Updated St"
        assert json["billing_address"]["city"] == "Updated City"


@pytest.mark.asyncio
class TesGetOrdersStatistics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.orders_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization: UserOrganization
    ) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.orders_read}),
    )
    async def test_organization(self, client: AsyncClient) -> None:
        response = await client.get("/v1/orders/statistics")

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12
