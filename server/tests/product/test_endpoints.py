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
            "/api/v1/products/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3

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
            "/api/v1/products/",
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
        response = await client.get(f"/api/v1/products/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.http_auto_expunge
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
    ) -> None:
        response = await client.get(f"/api/v1/products/{product.id}")

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

        response = await client.get(f"/api/v1/products/{product.id}")

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
            "/api/v1/products/",
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
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/products/",
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
            {"name": "This is a way too long name for a product"},
            {"name": "ab"},
            {"name": ""},
            {
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single product card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the web page."
                )
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
            "/api/v1/products/",
            json={
                "type": "individual",
                "name": "Product",
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "type": "recurring",
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
                    "recurring_interval": "month",
                    "price_amount": 1000,
                    "price_currency": "usd",
                }
            ],
            [
                {"type": "one_time", "price_amount": 1000, "price_currency": "usd"},
            ],
        ),
    )
    async def test_valid(
        self,
        prices: list[dict[str, Any]],
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
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
            "/api/v1/products/",
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
            f"/api/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/api/v1/products/{uuid.uuid4()}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "This is a way too long name for a product"},
            {"name": "ab"},
            {"name": ""},
            {
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single product card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the web page."
                )
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        product: Product,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/api/v1/products/{product.id}",
            json=payload,
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/api/v1/products/{product.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated Name"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateProductBenefits:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"/api/v1/products/{product.id}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/products/{uuid.uuid4()}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        product: Product,
        user_organization_admin: UserOrganization,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.post(
            f"/api/v1/products/{product.id}/benefits",
            json={"benefits": [str(benefit_organization.id)]},
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["benefits"]) == 1
