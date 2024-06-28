import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import Product


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateCheckout:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/checkouts/",
            json={
                "product_id": str(uuid.uuid4()),
                "product_price_id": str(uuid.uuid4()),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 422

    @pytest.mark.parametrize("success_url", [None, "INVALID_URL"])
    async def test_missing_invalid_success_url(
        self,
        success_url: str | None,
        client: AsyncClient,
        product: Product,
    ) -> None:
        json = {
            "product_id": str(product.id),
            "product_price_id": str(product.prices[0].id),
        }
        if success_url is not None:
            json["success_url"] = success_url

        response = await client.post("/v1/checkouts/", json=json)

        assert response.status_code == 422

    async def test_invalid_customer_email(
        self, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            "/v1/checkouts/",
            json={
                "product_id": str(product.id),
                "product_price_id": str(product.prices[0].id),
                "success_url": "https://polar.sh",
                "customer_email": "INVALID_EMAIL",
            },
        )

        assert response.status_code == 422

    async def test_anonymous_product_organization(
        self,
        client: AsyncClient,
        product: Product,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_checkout_session
        )
        create_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        response = await client.post(
            "/v1/checkouts/",
            json={
                "product_id": str(product.id),
                "product_price_id": str(product.prices[0].id),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["product"]["id"] == str(product.id)
        assert json["product_price"]["id"] == str(product.prices[0].id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetCheckout:
    async def test_valid_product_organization(
        self,
        client: AsyncClient,
        product: Product,
        stripe_service_mock: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={
                "product_id": str(product.id),
                "product_price_id": str(product.prices[0].id),
            },
        )

        response = await client.get("/v1/checkouts/SESSION_ID")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["customer_name"] == "John"
        assert json["customer_email"] == "backer@example.com"
        assert json["product"]["id"] == str(product.id)
        assert json["product_price"]["id"] == str(product.prices[0].id)
