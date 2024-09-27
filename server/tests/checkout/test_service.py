import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.checkout.schemas import (
    CheckoutConfirmStripe,
    CheckoutCreate,
    CheckoutUpdate,
)
from polar.checkout.service import (
    CheckoutDoesNotExist,
    NoCustomerOnPaymentIntent,
    NoPaymentMethodOnPaymentIntent,
    NotConfirmedCheckout,
    NotOpenCheckout,
    PaymentIntentNotSucceeded,
)
from polar.checkout.service import checkout as checkout_service
from polar.enums import PaymentProcessor
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.models import Checkout, Organization, Product, User, UserOrganization
from polar.models.checkout import CheckoutStatus
from polar.models.product_price import (
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    ProductPriceType,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_product_price_fixed


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    return mock


@pytest_asyncio.fixture
async def checkout_one_time_fixed(
    save_fixture: SaveFixture, product_one_time: Product
) -> Checkout:
    return await create_checkout(save_fixture, price=product_one_time.prices[0])


@pytest_asyncio.fixture
async def checkout_one_time_custom(
    save_fixture: SaveFixture, product_one_time_custom_price: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, price=product_one_time_custom_price.prices[0]
    )


@pytest_asyncio.fixture
async def checkout_one_time_free(
    save_fixture: SaveFixture, product_one_time_free_price: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, price=product_one_time_free_price.prices[0]
    )


@pytest_asyncio.fixture
async def checkout_recurring_fixed(
    save_fixture: SaveFixture, product: Product
) -> Checkout:
    return await create_checkout(save_fixture, price=product.prices[0])


@pytest_asyncio.fixture
async def checkout_recurring_free(
    save_fixture: SaveFixture, product_recurring_free_price: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, price=product_recurring_free_price.prices[0]
    )


@pytest_asyncio.fixture
async def checkout_confirmed_one_time(
    save_fixture: SaveFixture, product_one_time: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, price=product_one_time.prices[0], status=CheckoutStatus.confirmed
    )


@pytest_asyncio.fixture
async def checkout_confirmed_recurring(
    save_fixture: SaveFixture, product: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, price=product.prices[0], status=CheckoutStatus.confirmed
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreate:
    @pytest.mark.auth
    async def test_not_existing_price(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=uuid.uuid4(),
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second"),
        AuthSubjectFixture(subject="organization_second"),
    )
    async def test_not_writable_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=product_one_time.prices[0].id,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_archived_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = await create_product_price_fixed(
            save_fixture,
            product=product_one_time,
            type=ProductPriceType.one_time,
            is_archived=True,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutCreate(
                    payment_processor=PaymentProcessor.stripe, product_price_id=price.id
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_archived_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        product_one_time.is_archived = True
        await save_fixture(product_one_time)
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=product_one_time.prices[0].id,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_amount_set_on_fixed_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=product_one_time.prices[0].id,
                    amount=1000,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize("amount", [500, 10000])
    async def test_amount_invalid_limits(
        self,
        amount: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time_custom_price: Product,
    ) -> None:
        price = product_one_time_custom_price.prices[0]
        assert isinstance(price, ProductPriceCustom)
        price.minimum_amount = 1000
        price.maximum_amount = 5000
        await save_fixture(price)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=product_one_time_custom_price.prices[0].id,
                    amount=amount,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_fixed_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.create(
            session,
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time
        assert checkout.amount == price.price_amount
        assert checkout.currency == price.price_currency

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_free_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time_free_price: Product,
    ) -> None:
        price = product_one_time_free_price.prices[0]
        assert isinstance(price, ProductPriceFree)
        checkout = await checkout_service.create(
            session,
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_free_price
        assert checkout.amount is None
        assert checkout.currency is None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize("amount", [None, 1000])
    async def test_valid_custom_price(
        self,
        amount: int | None,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time_custom_price: Product,
    ) -> None:
        price = product_one_time_custom_price.prices[0]
        assert isinstance(price, ProductPriceCustom)
        price.preset_amount = 4242

        checkout = await checkout_service.create(
            session,
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                amount=amount,
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_custom_price
        if amount is None:
            assert checkout.amount == price.preset_amount
        else:
            assert checkout.amount == amount
        assert checkout.currency == price.price_currency


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdate:
    async def test_not_existing_price(
        self,
        session: AsyncSession,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                checkout_one_time_fixed,
                CheckoutUpdate(
                    product_price_id=uuid.uuid4(),
                ),
            )

    async def test_archived_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_organization: UserOrganization,
        product_one_time: Product,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        price = await create_product_price_fixed(
            save_fixture,
            product=product_one_time,
            type=ProductPriceType.one_time,
            is_archived=True,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                checkout_one_time_fixed,
                CheckoutUpdate(
                    product_price_id=price.id,
                ),
            )

    async def test_price_from_different_product(
        self,
        session: AsyncSession,
        user_organization: UserOrganization,
        product_one_time_custom_price: Product,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                checkout_one_time_fixed,
                CheckoutUpdate(
                    product_price_id=product_one_time_custom_price.prices[0].id,
                ),
            )

    async def test_amount_set_on_fixed_price(
        self,
        session: AsyncSession,
        user_organization: UserOrganization,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                checkout_one_time_fixed,
                CheckoutUpdate(
                    amount=1000,
                ),
            )

    @pytest.mark.parametrize("amount", [500, 10000])
    async def test_amount_update_invalid_limits(
        self,
        amount: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_organization: UserOrganization,
        checkout_one_time_custom: Checkout,
    ) -> None:
        price = checkout_one_time_custom.product.prices[0]
        assert isinstance(price, ProductPriceCustom)
        price.minimum_amount = 1000
        price.maximum_amount = 5000
        await save_fixture(price)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                checkout_one_time_custom,
                CheckoutUpdate(
                    amount=amount,
                ),
            )

    async def test_not_open(
        self,
        session: AsyncSession,
        user_organization: UserOrganization,
        checkout_confirmed_one_time: Checkout,
    ) -> None:
        with pytest.raises(NotOpenCheckout):
            await checkout_service.update(
                session,
                checkout_confirmed_one_time,
                CheckoutUpdate(
                    customer_email="customer@example.com",
                ),
            )

    async def test_valid_price_fixed_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_organization: UserOrganization,
        product: Product,
        checkout_recurring_fixed: Checkout,
    ) -> None:
        new_price = await create_product_price_fixed(
            save_fixture, product=product, type=ProductPriceType.recurring, amount=4242
        )
        checkout = await checkout_service.update(
            session,
            checkout_recurring_fixed,
            CheckoutUpdate(
                product_price_id=new_price.id,
            ),
        )

        assert checkout.product_price == new_price
        assert checkout.product == product
        assert checkout.amount == new_price.price_amount
        assert checkout.currency == new_price.price_currency

    async def test_valid_custom_price_amount_update(
        self,
        session: AsyncSession,
        user_organization: UserOrganization,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            checkout_one_time_custom,
            CheckoutUpdate(
                amount=4242,
            ),
        )
        assert checkout.amount == 4242


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestConfirm:
    async def test_missing_amount_on_custom_price(
        self,
        session: AsyncSession,
        checkout_one_time_custom: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                checkout_one_time_custom,
                CheckoutConfirmStripe.model_validate(
                    {
                        "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                        "amount": None,
                        "customer_name": "Customer Name",
                        "customer_email": "customer@example.com",
                        "customer_billing_address": {"country": "FR"},
                    }
                ),
            )

    async def test_missing_required_field(
        self, session: AsyncSession, checkout_one_time_fixed: Checkout
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                checkout_one_time_fixed,
                CheckoutConfirmStripe.model_validate(
                    {"confirmation_token_id": "CONFIRMATION_TOKEN_ID"}
                ),
            )

    async def test_not_open(
        self, session: AsyncSession, checkout_confirmed_one_time: Checkout
    ) -> None:
        with pytest.raises(NotOpenCheckout):
            await checkout_service.confirm(
                session,
                checkout_confirmed_one_time,
                CheckoutConfirmStripe.model_validate(
                    {"confirmation_token_id": "CONFIRMATION_TOKEN_ID"}
                ),
            )

    async def test_valid_stripe(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )
        checkout = await checkout_service.confirm(
            session,
            checkout_one_time_fixed,
            CheckoutConfirmStripe.model_validate(
                {
                    "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                    "customer_name": "Customer Name",
                    "customer_email": "customer@example.com",
                    "customer_billing_address": {"country": "FR"},
                }
            ),
        )

        assert checkout.status == checkout.status.confirmed
        assert checkout.payment_processor_metadata == {
            "payment_intent_client_secret": "CLIENT_SECRET",
            "payment_intent_status": "succeeded",
        }

        stripe_service_mock.create_customer.assert_called_once()
        stripe_service_mock.create_payment_intent.assert_called_once()
        assert stripe_service_mock.create_payment_intent.call_args[1]["metadata"] == {
            "checkout_id": str(checkout.id),
            "type": ProductType.product,
        }


def build_stripe_payment_intent(
    *,
    status: str = "succeeded",
    customer: str | None = "CUSTOMER_ID",
    payment_method: str | None = "PAYMENT_METHOD_ID",
) -> stripe_lib.PaymentIntent:
    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "STRIPE_PAYMENT_INTENT_ID",
            "status": status,
            "customer": customer,
            "payment_method": payment_method,
        },
        None,
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestHandleStripeSuccess:
    async def test_not_existing_checkout(self, session: AsyncSession) -> None:
        with pytest.raises(CheckoutDoesNotExist):
            await checkout_service.handle_stripe_success(
                session,
                uuid.uuid4(),
                build_stripe_payment_intent(),
            )

    async def test_not_confirmed_checkout(
        self, session: AsyncSession, checkout_one_time_fixed: Checkout
    ) -> None:
        with pytest.raises(NotConfirmedCheckout):
            await checkout_service.handle_stripe_success(
                session,
                checkout_one_time_fixed.id,
                build_stripe_payment_intent(),
            )

    async def test_not_succeeded_payment_intent(
        self, session: AsyncSession, checkout_confirmed_one_time: Checkout
    ) -> None:
        with pytest.raises(PaymentIntentNotSucceeded):
            await checkout_service.handle_stripe_success(
                session,
                checkout_confirmed_one_time.id,
                build_stripe_payment_intent(status="canceled"),
            )

    async def test_no_customer_on_payment_intent(
        self, session: AsyncSession, checkout_confirmed_one_time: Checkout
    ) -> None:
        with pytest.raises(NoCustomerOnPaymentIntent):
            await checkout_service.handle_stripe_success(
                session,
                checkout_confirmed_one_time.id,
                build_stripe_payment_intent(customer=None),
            )

    async def test_no_payment_method_on_payment_intent(
        self, session: AsyncSession, checkout_confirmed_one_time: Checkout
    ) -> None:
        with pytest.raises(NoPaymentMethodOnPaymentIntent):
            await checkout_service.handle_stripe_success(
                session,
                checkout_confirmed_one_time.id,
                build_stripe_payment_intent(payment_method=None),
            )

    async def test_valid_one_time(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        checkout_confirmed_one_time: Checkout,
    ) -> None:
        checkout = await checkout_service.handle_stripe_success(
            session, checkout_confirmed_one_time.id, build_stripe_payment_intent()
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_out_of_band_invoice.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_not_called()

    async def test_valid_recurring(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        checkout_confirmed_recurring: Checkout,
    ) -> None:
        checkout = await checkout_service.handle_stripe_success(
            session, checkout_confirmed_recurring.id, build_stripe_payment_intent()
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()
        stripe_service_mock.create_out_of_band_invoice.assert_not_called()

    async def test_valid_one_time_custom(
        self,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout_one_time_custom.status = CheckoutStatus.confirmed
        checkout_one_time_custom.amount = 4242
        await save_fixture(checkout_one_time_custom)

        stripe_service_mock.create_price_for_product.return_value = SimpleNamespace(
            id="STRIPE_CUSTOM_PRICE_ID"
        )

        checkout = await checkout_service.handle_stripe_success(
            session, checkout_one_time_custom.id, build_stripe_payment_intent()
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_price_for_product.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_not_called()

        stripe_service_mock.create_out_of_band_invoice.assert_called_once()
        assert (
            stripe_service_mock.create_out_of_band_invoice.call_args[1]["price"]
            == "STRIPE_CUSTOM_PRICE_ID"
        )
