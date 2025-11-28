import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.checkout.repository import CheckoutRepository
from polar.checkout.schemas import CheckoutProductCreate
from polar.checkout.service import checkout as checkout_service
from polar.enums import SubscriptionRecurringInterval
from polar.integrations.stripe.service import StripeService
from polar.kit.tax import calculate_tax
from polar.kit.utils import utc_now
from polar.models import (
    Checkout,
    Customer,
    Discount,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
    WebhookEndpoint,
)
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_discount,
    create_organization,
    create_product,
    create_product_price_seat_unit,
    create_webhook_endpoint,
)


@pytest.fixture(
    params=[
        "/v1/checkouts",
        "/v1/checkouts/custom",
    ]
)
def api_prefix(request: pytest.FixtureRequest) -> str:
    return request.param


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def calculate_tax_mock(mocker: MockerFixture) -> AsyncMock:
    mock = AsyncMock(spec=calculate_tax)
    mocker.patch("polar.checkout.service.calculate_tax", new=mock)
    mock.return_value = {"processor_id": "TAX_PROCESSOR_ID", "amount": 0}
    return mock


@pytest_asyncio.fixture
async def checkout_open(
    save_fixture: SaveFixture, product_one_time: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_one_time])


@pytest_asyncio.fixture(autouse=True)
async def webhook_endpoint(
    save_fixture: SaveFixture, organization: Organization
) -> WebhookEndpoint:
    return await create_webhook_endpoint(save_fixture, organization=organization)


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
        recurring_interval=SubscriptionRecurringInterval.month,
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
class TestList:
    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        api_prefix: str,
        user_organization: UserOrganization,
        client: AsyncClient,
        product: Product,
        product_one_time: Product,
        customer: Customer,
        subscription: Subscription,
        discount_percentage_50: Discount,
    ) -> None:
        checkouts = [
            await create_checkout(save_fixture, products=[product]),
            await create_checkout(
                save_fixture, products=[product], subscription=subscription
            ),
            await create_checkout(
                save_fixture, products=[product], discount=discount_percentage_50
            ),
            await create_checkout(save_fixture, products=[product], customer=customer),
            await create_checkout(save_fixture, products=[product_one_time]),
        ]

        session.expunge_all()

        response = await client.get(f"{api_prefix}/")
        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == len(checkouts)


@pytest.mark.asyncio
class TestGet:
    async def test_anonymous(
        self, api_prefix: str, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.get(f"{api_prefix}/{checkout_open.id}")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_not_existing(self, api_prefix: str, client: AsyncClient) -> None:
        response = await client.get(f"{api_prefix}/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_blocked_organization(
        self,
        api_prefix: str,
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

        response = await client.get(f"{api_prefix}/{checkout.id}")
        assert response.status_code == 200

        session.expunge_all()
        product.organization.blocked_at = utc_now()
        await save_fixture(product)

        response = await client.get(f"{api_prefix}/{checkout.id}")
        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_read}))
    async def test_valid(
        self,
        api_prefix: str,
        client: AsyncClient,
        checkout_open: Checkout,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"{api_prefix}/{checkout_open.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(checkout_open.id)
        assert "metadata" in json
        assert "product" in json
        assert "product_price" in json


@pytest.mark.asyncio
class TestCreateCheckout:
    async def test_anonymous(
        self, api_prefix: str, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_missing_scope(
        self, api_prefix: str, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    @pytest.mark.keep_session_state
    async def test_blocked_organization(
        self,
        api_prefix: str,
        client: AsyncClient,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
    ) -> None:
        product = await create_blocked_product(save_fixture, auth_subject)

        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_id": str(product.id),
            },
        )
        assert response.status_code == 403

        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
            },
        )
        assert response.status_code == 403

        product.organization.blocked_at = None
        await save_fixture(product)

        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_id": str(product.id),
            },
        )
        assert response.status_code == 201

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    @pytest.mark.parametrize(
        "customer_billing_address",
        [
            pytest.param(
                {
                    "city": "New York",
                    "country": "US",
                    "line1": "123 Main St",
                    "postal_code": "10001",
                    "state": "QC",
                },
                id="wrong state",
            ),
        ],
    )
    async def test_invalid_customer_billing_address(
        self,
        api_prefix: str,
        customer_billing_address: dict[str, str],
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(product.prices[0].id),
                "success_url": "https://example.com/success?checkout_id={CHECKOUT_ID}",
                "customer_billing_address": customer_billing_address,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_valid(
        self,
        api_prefix: str,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"{api_prefix}/",
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

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    @pytest.mark.parametrize(
        "external_customer_id_param",
        [
            "external_customer_id",
            "customer_external_id",
        ],
    )
    async def test_external_customer_id(
        self,
        api_prefix: str,
        external_customer_id_param: str,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        body = {
            "payment_processor": "stripe",
            "product_price_id": str(product.prices[0].id),
            "success_url": "https://example.com/success?checkout_id={CHECKOUT_ID}",
        }
        body[external_customer_id_param] = "external_customer_id_value"

        response = await client.post(f"{api_prefix}/", json=body)

        assert response.status_code == 201

        json = response.json()
        assert json["external_customer_id"] == "external_customer_id_value"
        assert json["customer_external_id"] == "external_customer_id_value"

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_return_url(
        self,
        api_prefix: str,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        body = {
            "payment_processor": "stripe",
            "product_price_id": str(product.prices[0].id),
            "return_url": "https://example.com/return",
        }

        response = await client.post(f"{api_prefix}/", json=body)

        assert response.status_code == 201

        json = response.json()
        assert json["return_url"] == "https://example.com/return"

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_valid_seat_based_checkout(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=1500
        )
        product.prices = [price]

        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(price.id),
                "seats": 6,
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["seats"] == 6
        assert json["amount"] == 1500 * 6
        assert json["product_price"]["id"] == str(price.id)

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_seat_based_missing_seats(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=1500
        )
        product.prices = [price]

        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "product_price_id": str(price.id),
            },
        )

        assert response.status_code == 422

        json = response.json()
        assert any(error["loc"] == ["body", "seats"] for error in json["detail"])

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_valid_ad_hoc_prices(
        self,
        api_prefix: str,
        client: AsyncClient,
        product: Product,
        product_recurring_trial: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"{api_prefix}/",
            json={
                "payment_processor": "stripe",
                "products": [str(product.id), str(product_recurring_trial.id)],
                "prices": {
                    str(product.id): [
                        {
                            "amount_type": "fixed",
                            "price_amount": 100_00,
                            "currency": "usd",
                        }
                    ],
                    str(product_recurring_trial.id): [
                        {
                            "amount_type": "fixed",
                            "price_amount": 50_00,
                            "currency": "usd",
                        }
                    ],
                },
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert len(json["products"]) == 2

        for p in [product, product_recurring_trial]:
            assert len(json["prices"][str(p.id)]) == 1
            ad_hoc_price = json["prices"][str(p.id)][0]
            assert ad_hoc_price["id"] != str(p.prices[0].id)


@pytest.mark.asyncio
class TestUpdateCheckout:
    async def test_anonymous(
        self, api_prefix: str, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{api_prefix}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_missing_scope(
        self, api_prefix: str, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{api_prefix}/{checkout_open.id}",
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
        self, api_prefix: str, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.patch(
            f"{api_prefix}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_valid(
        self,
        api_prefix: str,
        client: AsyncClient,
        checkout_open: Checkout,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"{api_prefix}/{checkout_open.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["metadata"] == {"test": "test"}

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_update_seats(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=2500
        )
        product.prices = [price]

        checkout = await create_checkout(save_fixture, products=[product], seats=4)

        response = await client.patch(
            f"{api_prefix}/{checkout.id}",
            json={
                "seats": 10,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["seats"] == 10
        assert json["amount"] == 2500 * 10

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_update_seats_amount_calculation(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=3000
        )
        product.prices = [price]

        checkout = await create_checkout(save_fixture, products=[product], seats=2)

        # Initial state
        response = await client.get(f"{api_prefix}/{checkout.id}")
        json = response.json()
        assert json["seats"] == 2
        assert json["amount"] == 3000 * 2

        # Update to 7 seats
        response = await client.patch(
            f"{api_prefix}/{checkout.id}",
            json={"seats": 7},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["seats"] == 7
        assert json["amount"] == 3000 * 7

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.checkouts_write}))
    async def test_update_with_discount(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        checkout_open: Checkout,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5_000,
            duration=DiscountDuration.once,
            organization=organization,
            code="TESTDISCOUNT50",
        )

        response = await client.patch(
            f"{api_prefix}/{checkout_open.id}",
            json={
                "discount_id": str(discount.id),
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["discount"] is not None
        assert json["discount"]["id"] == str(discount.id)


@pytest.mark.asyncio
class TestClientGet:
    async def test_not_existing(self, api_prefix: str, client: AsyncClient) -> None:
        response = await client.get(f"{api_prefix}/client/123")

        assert response.status_code == 404

    async def test_expired(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        product: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.expired,
            expires_at=utc_now() - timedelta(days=1),
        )

        response = await client.get(f"{api_prefix}/client/{checkout.client_secret}")

        assert response.status_code == 410

    async def test_valid(
        self, api_prefix: str, client: AsyncClient, checkout_open: Checkout
    ) -> None:
        response = await client.get(
            f"{api_prefix}/client/{checkout_open.client_secret}"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(checkout_open.id)
        assert "metadata" not in json


@pytest.mark.asyncio
class TestClientCreateCheckout:
    @pytest.mark.auth(AuthSubjectFixture(subject="user", scopes=set()))
    async def test_missing_scope(
        self, api_prefix: str, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            f"{api_prefix}/client/", json={"product_id": str(product.id)}
        )

        assert response.status_code == 403

    async def test_anonymous(
        self, api_prefix: str, client: AsyncClient, product: Product
    ) -> None:
        response = await client.post(
            f"{api_prefix}/client/", json={"product_id": str(product.id)}
        )

        assert response.status_code == 201

    @pytest.mark.auth
    async def test_user(
        self,
        api_prefix: str,
        client: AsyncClient,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"{api_prefix}/client/", json={"product_id": str(product.id)}
        )

        assert response.status_code == 201


@pytest.mark.asyncio
class TestClientUpdate:
    async def test_not_existing(self, api_prefix: str, client: AsyncClient) -> None:
        response = await client.patch(
            f"{api_prefix}/client/123", json={"customer_name": "Customer Name"}
        )

        assert response.status_code == 404

    async def test_valid(
        self,
        api_prefix: str,
        session: AsyncSession,
        client: AsyncClient,
        checkout_open: Checkout,
    ) -> None:
        response = await client.patch(
            f"{api_prefix}/client/{checkout_open.client_secret}",
            json={
                "customer_name": "Customer Name",
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["customer_name"] == "Customer Name"
        assert "metadata" not in json

        repository = CheckoutRepository.from_session(session)
        updated_checkout = await repository.get_by_id(checkout_open.id)
        assert updated_checkout is not None
        assert updated_checkout.user_metadata == {}

    async def test_update_with_discount_code(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        client: AsyncClient,
        checkout_open: Checkout,
        organization: Organization,
    ) -> None:
        await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5_000,
            duration=DiscountDuration.once,
            organization=organization,
            code="TESTDISCOUNT50",
        )

        response = await client.patch(
            f"{api_prefix}/client/{checkout_open.client_secret}",
            json={
                "discount_code": "TESTDISCOUNT50",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["discount"] is not None
        assert json["discount"]["code"] == "TESTDISCOUNT50"


@pytest.mark.asyncio
class TestClientConfirm:
    async def test_not_existing(self, api_prefix: str, client: AsyncClient) -> None:
        response = await client.post(
            f"{api_prefix}/client/123/confirm",
            json={"confirmation_token_id": "CONFIRMATION_TOKEN_ID"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "customer_billing_address",
        [
            pytest.param(
                {
                    "city": "New York",
                    "country": "US",
                    "line1": "123 Main St",
                    "postal_code": "10001",
                    "state": "QC",
                },
                id="wrong state",
            ),
        ],
    )
    async def test_invalid_customer_billing_address(
        self,
        api_prefix: str,
        customer_billing_address: dict[str, str],
        stripe_service_mock: MagicMock,
        client: AsyncClient,
        checkout_open: Checkout,
    ) -> None:
        response = await client.post(
            f"{api_prefix}/client/{checkout_open.client_secret}/confirm",
            json={
                "customer_name": "Customer Name",
                "customer_email": "customer@example.com",
                "customer_billing_address": customer_billing_address,
                "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
            },
        )

        assert response.status_code == 422

    async def test_valid(
        self,
        api_prefix: str,
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
            f"{api_prefix}/client/{checkout_open.client_secret}/confirm",
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

    async def test_confirm_with_discount_code(
        self,
        api_prefix: str,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        client: AsyncClient,
        checkout_open: Checkout,
        organization: Organization,
    ) -> None:
        await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5_000,
            duration=DiscountDuration.once,
            organization=organization,
            code="TESTDISCOUNT50",
        )

        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )

        response = await client.post(
            f"{api_prefix}/client/{checkout_open.client_secret}/confirm",
            json={
                "customer_name": "Customer Name",
                "customer_email": "customer@example.com",
                "customer_billing_address": {"country": "FR"},
                "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                "discount_code": "TESTDISCOUNT50",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["discount"] is not None
        assert json["discount"]["code"] == "TESTDISCOUNT50"
