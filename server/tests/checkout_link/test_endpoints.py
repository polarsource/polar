import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.checkout.service import CHECKOUT_CLIENT_SECRET_PREFIX
from polar.models import CheckoutLink, Product, ProductPrice, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout_link


@pytest_asyncio.fixture
async def checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    return await create_checkout_link(
        save_fixture,
        product=product,
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
                "product_id": str(product.id),
            },
        )

        assert response.status_code == 401

    async def test_anonymous_with_price(
        self, client: AsyncClient, product: Product
    ) -> None:
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
                "product_id": str(product.id),
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope_with_price(
        self, client: AsyncClient, product: Product
    ) -> None:
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
                "product_id": str(product.id),
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "client_secret" in json
        assert json["client_secret"] in json["url"]
        assert "metadata" in json
        assert json["product_price"] is None
        assert json["product_price_id"] is None

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkout_links_write}))
    async def test_valid_with_price(
        self, client: AsyncClient, product: Product, user_organization: UserOrganization
    ) -> None:
        price_id = product.prices[0].id
        response = await client.post(
            "/v1/checkout-links/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(price_id),
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "client_secret" in json
        assert json["client_secret"] in json["url"]
        assert "metadata" in json
        assert json["product_price"] is not None
        assert json["product_price"]["id"] == str(price_id)
        assert json["product_price_id"] == str(price_id)


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

        response = await client.get(f"/v1/checkouts/custom/client/{client_secret}")
        assert response.status_code == 200
        checkout = response.json()
        assert checkout.get("product_price_id") == str(price.id)

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

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_valid_with_explicit_price(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product_recurring_monthly_and_yearly: Product,
    ) -> None:
        product = product_recurring_monthly_and_yearly
        second_price = product.prices[1]
        checkout_link = await create_checkout_link(
            save_fixture, product=product, price=second_price
        )
        await self.assert_checkout_price(client, checkout_link, second_price)

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_no_explicit_price_set(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product_recurring_monthly_and_yearly: Product,
    ) -> None:
        product = product_recurring_monthly_and_yearly
        checkout_link = await create_checkout_link(
            save_fixture,
            product=product,
        )
        await self.assert_checkout_price(client, checkout_link, product.prices[0])

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_archived_price_set(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product_recurring_monthly_and_yearly: Product,
    ) -> None:
        product = product_recurring_monthly_and_yearly
        first_price = product.prices[0]
        second_price = product.prices[1]
        checkout_link = await create_checkout_link(
            save_fixture, product=product, price=product.prices[0]
        )

        await self.assert_checkout_price(client, checkout_link, first_price)
        first_price.is_archived = True
        await save_fixture(first_price)
        await self.assert_checkout_price(client, checkout_link, second_price)
