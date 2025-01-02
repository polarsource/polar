import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.checkout.schemas import CheckoutProductCreate
from polar.checkout.service import checkout as checkout_service
from polar.integrations.stripe.service import StripeService
from polar.kit.tax import calculate_tax
from polar.kit.utils import utc_now
from polar.models import Checkout, Product, User, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_organization,
    create_product,
)

API_PREFIX = "/v1/checkouts/custom"


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def calculate_tax_mock(mocker: MockerFixture) -> AsyncMock:
    mock = AsyncMock(spec=calculate_tax)
    mocker.patch("polar.checkout.service.calculate_tax", new=mock)
    mock.return_value = 0
    return mock


@pytest_asyncio.fixture
async def checkout_open(
    save_fixture: SaveFixture, product_one_time: Product
) -> Checkout:
    return await create_checkout(save_fixture, price=product_one_time.prices[0])


async def create_blocked_product(
    save_fixture: SaveFixture,
    auth_subject: AuthSubject[User],
) -> Product:
    org = await create_organization(
        save_fixture,
        name_prefix="blockedorg",
        blocked_at=utc_now(),
    )
    product = await create_product(
        save_fixture,
        organization=org,
        name="Prohibited product",
        is_archived=False,
    )
    user_organization = UserOrganization(
        user_id=auth_subject.subject.id,
        organization_id=org.id,
    )
    await save_fixture(user_organization)
    return product


@pytest.mark.asyncio
class TestGet:
    async def test_anonymous(
        self, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.get(f"{API_PREFIX}/{checkout_open.id}")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"{API_PREFIX}/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_blocked_organization(
        self,
        session: AsyncSession,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
    ) -> None:
        product = await create_blocked_product(save_fixture, auth_subject)
        product.organization.blocked_at = None
        await save_fixture(product)

        checkout = await checkout_service.create(
            session,
            CheckoutProductCreate(
                product_id=product.id,
            ),
            auth_subject,
        )

        response = await client.get(f"{API_PREFIX}/{checkout.id}")
        assert response.status_code == 200

        session.expunge_all()
        product.organization.blocked_at = utc_now()
        await save_fixture(product)

        response = await client.get(f"{API_PREFIX}/{checkout.id}")
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_valid(
        self,
        client: AsyncClient,
        checkout_open: Checkout,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"{API_PREFIX}/{checkout_open.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(checkout_open.id)
        assert "metadata" in json
        assert "product" in json
        assert "product_price" in json


@pytest.mark.asyncio
class TestCreateCheckout:
    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"{API_PREFIX}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_missing_scope(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"{API_PREFIX}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_blocked_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
    ) -> None:
        product = await create_blocked_product(save_fixture, auth_subject)

        response = await client.post(
            f"{API_PREFIX}/",
            json={
                "payment_processor": "stripe",
                "product_id": str(product.id),
            },
        )
        assert response.status_code == 403

        response = await client.post(
            f"{API_PREFIX}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )
        assert response.status_code == 403

        product.organization.blocked_at = None
        await save_fixture(product)

        response = await client.post(
            f"{API_PREFIX}/",
            json={
                "payment_processor": "stripe",
                "product_id": str(product.id),
            },
        )
        assert response.status_code == 201

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_valid(
        self, client: AsyncClient, product: Product, user_organization: UserOrganization
    ) -> None:
        response = await client.post(
            f"{API_PREFIX}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
                "success_url": "https://example.com/success?checkout_id={CHECKOUT_ID}",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "client_secret" in json
        assert "metadata" in json
        assert (
            json["success_url"]
            == f"https://example.com/success?checkout_id={json['id']}"
        )


@pytest.mark.asyncio
class TestUpdateCheckout:
    async def test_anonymous(
        self, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{API_PREFIX}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_missing_scope(
        self, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{API_PREFIX}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second", scopes={Scope.checkouts_write}),
        AuthSubjectFixture(
            subject="organization_second", scopes={Scope.checkouts_write}
        ),
    )
    async def test_not_writable(
        self, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{API_PREFIX}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_valid(
        self,
        client: AsyncClient,
        checkout_open: Checkout,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"{API_PREFIX}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["metadata"] == {"test": "test"}


@pytest.mark.asyncio
class TestClientGet:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"{API_PREFIX}/client/123")

        assert response.status_code == 404

    async def test_valid(self, client: AsyncClient, checkout_open: Checkout) -> None:
        response = await client.get(
            f"{API_PREFIX}/client/{checkout_open.client_secret}"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(checkout_open.id)
        assert "metadata" not in json


@pytest.mark.asyncio
class TestClientCreateCheckout:
    @pytest.mark.auth(AuthSubjectFixture(subject="user", scopes=set()))
    async def test_missing_scope(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"{API_PREFIX}/client/",
            json={
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 403

    async def test_anonymous(self, client: AsyncClient, product: Product) -> None:
        response = await client.post(
            f"{API_PREFIX}/client/",
            json={
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 201

    @pytest.mark.auth
    async def test_user(
        self, client: AsyncClient, product: Product, user_organization: UserOrganization
    ) -> None:
        response = await client.post(
            f"{API_PREFIX}/client/",
            json={
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 201


@pytest.mark.asyncio
class TestClientUpdate:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"{API_PREFIX}/client/123", json={"customer_name": "Customer Name"}
        )

        assert response.status_code == 404

    async def test_valid(
        self, session: AsyncSession, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{API_PREFIX}/client/{checkout_open.client_secret}",
            json={
                "customer_name": "Customer Name",
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["customer_name"] == "Customer Name"
        assert "metadata" not in json

        updated_checkout = await checkout_service.get(session, checkout_open.id)
        assert updated_checkout is not None
        assert updated_checkout.user_metadata == {}


@pytest.mark.asyncio
class TestClientConfirm:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"{API_PREFIX}/client/123/confirm",
            json={"confirmation_token_id": "CONFIRMATION_TOKEN_ID"},
        )

        assert response.status_code == 404

    async def test_valid(
        self,
        stripe_service_mock: MagicMock,
        client: AsyncClient,
        checkout_open: Checkout,
    ) -> None:
        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )
        response = await client.post(
            f"{API_PREFIX}/client/{checkout_open.client_secret}/confirm",
            json={
                "customer_name": "Customer Name",
                "customer_email": "customer@example.com",
                "customer_billing_address": {"country": "FR"},
                "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert "customer_session_token" in json
