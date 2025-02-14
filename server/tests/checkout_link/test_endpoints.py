import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.checkout.service import CHECKOUT_CLIENT_SECRET_PREFIX
from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import CheckoutLink, Product, ProductPrice, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout_link,
    create_organization,
    create_product,
)


@pytest_asyncio.fixture
async def checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    return await create_checkout_link(
        save_fixture,
        products=[product],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )


@pytest.mark.asyncio
class TestCreateCheckoutLink:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            "/v1/checkout-links/",
            json={
                "payment_processor": "stripe",
                "products": [str(product.id)],
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            "/v1/checkout-links/",
            json={
                "payment_processor": "stripe",
                "products": [str(product.id)],
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope_with_price(
        self, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            "/v1/checkout-links/",
            json={"payment_processor": "stripe", "products": [str(product.id)]},
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
                "products": [str(product.id)],
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "client_secret" in json
        assert json["client_secret"] in json["url"]
        assert "metadata" in json


@pytest.mark.asyncio
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
class TestRedirect:
    def client_secret_from_redirect_url(self, url: str) -> str:
        client_secret = url.split("/")[-1]
        return client_secret

    async def assert_checkout_price(
        self, client: AsyncClient, link: CheckoutLink, price: ProductPrice
    ) -> None:
        response = await client.get(f"/v1/checkout-links/{link.client_secret}/redirect")
        assert response.status_code == 307
        client_secret = self.client_secret_from_redirect_url(
            response.headers["location"]
        )
        assert CHECKOUT_CLIENT_SECRET_PREFIX in client_secret

        response = await client.get(f"/v1/checkouts/client/{client_secret}")
        assert response.status_code == 200

    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get("/v1/checkout-links/not-existing/redirect")

        assert response.status_code == 404

    async def test_blocked_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
    ) -> None:
        org = await create_organization(
            save_fixture,
            name_prefix="blockedorg",
            blocked_at=utc_now(),
        )
        product = await create_product(
            save_fixture,
            organization=org,
            recurring_interval=SubscriptionRecurringInterval.month,
            name="Prohibited product",
            is_archived=False,
        )
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product],
            success_url="https://example.com/success",
            user_metadata={"key": "value"},
        )
        response = await client.get(
            f"/v1/checkout-links/{checkout_link.client_secret}/redirect"
        )
        assert response.status_code == 404

    async def test_valid(
        self, client: AsyncClient, checkout_link: CheckoutLink
    ) -> None:
        response = await client.get(
            f"/v1/checkout-links/{checkout_link.client_secret}/redirect"
        )

        assert response.status_code == 307
        assert CHECKOUT_CLIENT_SECRET_PREFIX in response.headers["location"]
