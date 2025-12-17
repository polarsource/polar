import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from polar.models import (
    Benefit,
    Organization,
    Product,
    ProductPriceFixed,
    UserOrganization,
)
from polar.models.custom_field import CustomFieldType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_custom_field,
    create_product,
    set_product_benefits,
)


@pytest.mark.asyncio
class TestListProducts:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/v1/products/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_with_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        response = await client.get(
            "/v1/products/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        item = items[0]
        assert item["id"] == str(product.id)
        assert len(item["benefits"]) == len(benefits)
        for benefit in item["benefits"]:
            assert "properties" in benefit


@pytest.mark.asyncio
class TestGetProduct:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/products/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(product.id)

    @pytest.mark.auth
    async def test_valid_with_benefits(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
        benefits: list[Benefit],
        user_organization: UserOrganization,
    ) -> None:
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(product.id)
        assert len(json["benefits"]) == len(benefits)
        for benefit in json["benefits"]:
            assert "properties" in benefit


@pytest.mark.asyncio
class TestCreateProduct:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "type": "individual",
                "name": "Product",
                "price_amount": 1000,
                "organization_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "ab"},
            {"name": ""},
            # No price
            {"prices": []},
            # Two prices
            {
                "prices": [
                    {"amount_type": "fixed", "price_amount": 1000},
                    {"amount_type": "fixed", "price_amount": 10000},
                ]
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        session: AsyncSession,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "amount_type": "fixed",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
                **payload,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param(
                {
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="One-time fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "custom",
                            "minimum_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="One-time custom",
            ),
            pytest.param(
                {
                    "recurring_interval": None,
                    "prices": [
                        {
                            "amount_type": "free",
                            "price_currency": "usd",
                        }
                    ],
                },
                id="One-time free",
            ),
            pytest.param(
                {
                    "recurring_interval": "day",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring daily fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "week",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring weekly fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring monthly fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "year",
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring yearly fixed",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "prices": [
                        {
                            "amount_type": "custom",
                            "minimum_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring custom",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "prices": [
                        {
                            "amount_type": "free",
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring free",
            ),
            pytest.param(
                {
                    "recurring_interval": "month",
                    "recurring_interval_count": 3,
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": 1000,
                            "price_currency": "usd",
                        }
                    ],
                },
                id="Recurring with interval count",
            ),
        ],
    )
    async def test_valid(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "name": "Product",
                "organization_id": str(organization.id),
                **payload,
            },
        )

        assert response.status_code == 201


@pytest.mark.asyncio
class TestUpdateProduct:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.patch(
            f"/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/products/{uuid.uuid4()}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated Name"

    @pytest.mark.auth
    async def test_existing_price_with_full_schema(
        self,
        client: AsyncClient,
        product_one_time: Product,
        user_organization: UserOrganization,
    ) -> None:
        """
        We should handle the case where we want to keep the existing price, but we pass
        the full schema of it.

        It happens from the frontend where it's cumbersome
        to get rid of the full schema.
        """
        response = await client.patch(
            f"/v1/products/{product_one_time.id}",
            json={
                "prices": [
                    {
                        "id": str(product_one_time.prices[0].id),
                        "price_amount": 2000,
                        "price_currency": "usd",
                        "is_archived": False,
                        "amount_type": "fixed",
                    }
                ]
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["prices"]) == 1
        price = json["prices"][0]
        assert price["id"] == str(product_one_time.prices[0].id)

        product_price = product_one_time.prices[0]
        assert isinstance(product_price, ProductPriceFixed)
        assert price["price_amount"] == product_price.price_amount

    @pytest.mark.auth
    async def test_invalid_attached_custom_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        custom_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.text,
            slug="test-field",
            organization=organization,
        )
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            attached_custom_fields=[
                (custom_field, True),
            ],
        )

        response = await client.patch(
            f"/v1/products/{product.id}",
            json={
                "attached_custom_fields": [
                    {
                        "custom_field_id": str(uuid.uuid4()),
                        "required": False,
                    }
                ]
            },
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestUpdateProductBenefits:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"/v1/products/{product.id}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/v1/products/{uuid.uuid4()}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.post(
            f"/v1/products/{product.id}/benefits",
            json={"benefits": [str(benefit_organization.id)]},
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["benefits"]) == 1
