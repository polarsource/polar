import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.checkout.service import CHECKOUT_CLIENT_SECRET_PREFIX
from polar.models import CheckoutLink, Product, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout_link


@pytest_asyncio.fixture
async def checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    return await create_checkout_link(
        save_fixture,
        price=product.prices[0],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreateCheckoutLink:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            "/v1/checkout-links/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            "/v1/checkout-links/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkout_links_write}))
    async def test_valid(
        self, client: AsyncClient, product: Product, user_organization: UserOrganization
    ) -> None:
        response = await client.post(
            "/v1/checkout-links/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "client_secret" in json
        assert json["client_secret"] in json["url"]
        assert "metadata" in json


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdateCheckoutLink:
    async def test_anonymous(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.patch(
            f"/v1/checkout-links/{checkout_link.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.patch(
            f"/v1/checkout-links/{checkout_link.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second", scopes={Scope.checkout_links_write}),
        AuthSubjectFixture(
            subject="organization_second", scopes={Scope.checkout_links_write}
        ),
    )
    async def test_not_writable(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.patch(
            f"/v1/checkout-links/{checkout_link.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.checkout_links_write}),
        AuthSubjectFixture(subject="organization", scopes={Scope.checkout_links_write}),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        checkout_link: CheckoutLink,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/checkout-links/{checkout_link.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["metadata"] == {"test": "test"}


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestDeleteCheckoutLink:
    async def test_anonymous(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.delete(f"/v1/checkout-links/{checkout_link.id}")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.delete(f"/v1/checkout-links/{checkout_link.id}")

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second", scopes={Scope.checkout_links_write}),
        AuthSubjectFixture(
            subject="organization_second", scopes={Scope.checkout_links_write}
        ),
    )
    async def test_not_writable(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.delete(f"/v1/checkout-links/{checkout_link.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.checkout_links_write}),
        AuthSubjectFixture(subject="organization", scopes={Scope.checkout_links_write}),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        checkout_link: CheckoutLink,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(f"/v1/checkout-links/{checkout_link.id}")

        assert response.status_code == 204


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestRedirect:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get("/v1/checkout-links/not-existing/redirect")

        assert response.status_code == 404

    async def test_valid(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.get(
            f"/v1/checkout-links/{checkout_link.client_secret}/redirect"
        )

        assert response.status_code == 307
        assert CHECKOUT_CLIENT_SECRET_PREFIX in response.headers["location"]
