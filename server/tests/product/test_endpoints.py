import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from polar.models import (
    Benefit,
    Organization,
    Product,
    ProductPriceFixed,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    add_product_benefits,
)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListProducts:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        products: list[Product],
    ) -> None:
        response = await client.get(
            "/v1/products/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2

    async def test_anonymous_without_organization_filter(
        self,
        client: AsyncClient,
        organization: Organization,
        products: list[Product],
    ) -> None:
        response = await client.get(
            "/v1/products/",
        )

        assert response.status_code == 422

    async def test_with_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        # then
        session.expunge_all()

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
            assert "properties" not in benefit
            assert "is_tax_applicable" not in benefit


@pytest.mark.asyncio
class TestGetProduct:
    @pytest.mark.http_auto_expunge
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/products/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.http_auto_expunge
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
    ) -> None:
        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(product.id)

    async def test_valid_with_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        # then
        session.expunge_all()

        response = await client.get(f"/v1/products/{product.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(product.id)
        assert len(json["benefits"]) == len(benefits)
        for benefit in json["benefits"]:
            assert "properties" not in benefit
            assert "is_tax_applicable" not in benefit


@pytest.mark.asyncio
class TestCreateProduct:
    @pytest.mark.http_auto_expunge
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

    @pytest.mark.auth
    @pytest.mark.http_auto_expunge
    async def test_cant_create_free_type_tier(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/products/",
            json={
                "type": "free",
                "name": "Subscription Tier",
                "price_amount": 1000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "ab"},
            {"name": ""},
            {
                "description": (
                    "This is just a simple product description that should be allowed"
                )
            },
            # No price
            {"prices": []},
            # One recurring and one one-time prices
            {
                "prices": [
                    {
                        "type": "recurring",
                        "recurring_interval": "month",
                        "price_amount": 1000,
                    },
                    {"type": "one_time", "price_amount": 1000},
                ]
            },
            # Three recurring prices
            {
                "prices": [
                    {
                        "type": "recurring",
                        "recurring_interval": "month",
                        "price_amount": 1000,
                    }
                    for _ in range(3)
                ]
            },
            # Repeat the same interval
            {
                "prices": [
                    {
                        "type": "recurring",
                        "recurring_interval": "month",
                        "price_amount": 1000,
                    }
                    for _ in range(2)
                ]
            },
            # Two one-time prices
            {
                "prices": [
                    {"type": "one_time", "amount_type": "fixed", "price_amount": 1000}
                    for _ in range(2)
                ]
            },
            # Two free prices
            {
                "prices": [
                    {"type": "one_time", "amount_type": "free", "price_amount": 1000}
                    for _ in range(2)
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
        stripe_service_mock: MagicMock,
        session: AsyncSession,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        # then
        session.expunge_all()

        response = await client.post(
            "/v1/products/",
            json={
                "type": "individual",
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "type": "recurring",
                        "amount_type": "fixed",
                        "recurring_interval": "month",
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
        "prices",
        (
            [
                {
                    "type": "recurring",
                    "amount_type": "fixed",
                    "recurring_interval": "month",
                    "price_amount": 1000,
                    "price_currency": "usd",
                }
            ],
            [
                {
                    "type": "one_time",
                    "amount_type": "fixed",
                    "price_amount": 1000,
                    "price_currency": "usd",
                },
            ],
        ),
    )
    async def test_valid(
        self,
        prices: list[dict[str, Any]],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        # then
        session.expunge_all()

        response = await client.post(
            "/v1/products/",
            json={
                "type": "individual",
                "name": "Product",
                "price_amount": 1000,
                "organization_id": str(organization.id),
                "prices": prices,
            },
        )

        assert response.status_code == 201


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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
                        "type": "one_time",
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


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
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
