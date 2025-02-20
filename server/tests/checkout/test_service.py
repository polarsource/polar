import uuid
from datetime import timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pydantic import HttpUrl, ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.auth.models import Anonymous, AuthSubject
from polar.checkout.schemas import (
    CheckoutConfirmStripe,
    CheckoutCreatePublic,
    CheckoutPriceCreate,
    CheckoutProductCreate,
    CheckoutProductsCreate,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from polar.checkout.service import (
    AlreadyActiveSubscriptionError,
    CheckoutDoesNotExist,
    NoCustomerOnCheckout,
    NoCustomerOnPaymentIntent,
    NoPaymentMethodOnPaymentIntent,
    NotConfirmedCheckout,
    NotOpenCheckout,
    PaymentIntentNotSucceeded,
    PaymentRequired,
)
from polar.checkout.service import checkout as checkout_service
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.repository import DiscountRedemptionRepository
from polar.discount.service import discount as discount_service
from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
from polar.kit.tax import IncompleteTaxLocation, TaxIDFormat, calculate_tax
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import (
    Checkout,
    CheckoutProduct,
    Customer,
    Discount,
    DiscountRedemption,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.custom_field import CustomFieldType
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.product_price import (
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_checkout_link,
    create_custom_field,
    create_customer,
    create_discount,
    create_product,
    create_product_price_fixed,
    create_subscription,
)


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
async def checkout_one_time_fixed(
    save_fixture: SaveFixture, product_one_time: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_one_time])


@pytest_asyncio.fixture
async def checkout_one_time_custom(
    save_fixture: SaveFixture, product_one_time_custom_price: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_one_time_custom_price])


@pytest_asyncio.fixture
async def checkout_one_time_free(
    save_fixture: SaveFixture, product_one_time_free_price: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_one_time_free_price])


@pytest_asyncio.fixture
async def checkout_recurring_fixed(
    save_fixture: SaveFixture, product: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product])


@pytest_asyncio.fixture
async def checkout_recurring_free(
    save_fixture: SaveFixture, product_recurring_free_price: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_recurring_free_price])


@pytest_asyncio.fixture
async def checkout_confirmed_one_time(
    save_fixture: SaveFixture, product_one_time: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, products=[product_one_time], status=CheckoutStatus.confirmed
    )


@pytest_asyncio.fixture
async def checkout_confirmed_recurring(
    save_fixture: SaveFixture, product: Product
) -> Checkout:
    return await create_checkout(
        save_fixture, products=[product], status=CheckoutStatus.confirmed
    )


@pytest_asyncio.fixture
async def checkout_confirmed_recurring_upgrade(
    save_fixture: SaveFixture,
    product: Product,
    product_recurring_free_price: Product,
    customer: Customer,
) -> Checkout:
    subscription = await create_subscription(
        save_fixture, product=product_recurring_free_price, customer=customer
    )
    return await create_checkout(
        save_fixture,
        products=[product],
        status=CheckoutStatus.confirmed,
        subscription=subscription,
    )


@pytest_asyncio.fixture
async def checkout_discount_percentage_100(
    save_fixture: SaveFixture, product: Product, discount_percentage_100: Discount
) -> Checkout:
    return await create_checkout(
        save_fixture,
        products=[product],
        status=CheckoutStatus.open,
        discount=discount_percentage_100,
    )


@pytest_asyncio.fixture
async def product_custom_fields(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    text_field = await create_custom_field(
        save_fixture, type=CustomFieldType.text, slug="text", organization=organization
    )
    select_field = await create_custom_field(
        save_fixture,
        type=CustomFieldType.select,
        slug="select",
        organization=organization,
        properties={
            "options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}],
        },
    )
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        attached_custom_fields=[(text_field, False), (select_field, True)],
    )


@pytest_asyncio.fixture
async def checkout_custom_fields(
    save_fixture: SaveFixture, product_custom_fields: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_custom_fields])


@pytest_asyncio.fixture
async def product_tax_not_applicable(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        is_tax_applicable=False,
    )


@pytest_asyncio.fixture
async def checkout_tax_not_applicable(
    save_fixture: SaveFixture, product_tax_not_applicable: Product
) -> Checkout:
    return await create_checkout(save_fixture, products=[product_tax_not_applicable])


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_not_existing_price(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
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
                CheckoutPriceCreate(
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
            is_archived=True,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(product_price_id=price.id),
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
                CheckoutPriceCreate(
                    product_price_id=product_one_time.prices[0].id,
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
                CheckoutPriceCreate(
                    product_price_id=product_one_time_custom_price.prices[0].id,
                    amount=amount,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize(
        "payload",
        (
            {"customer_tax_id": "123"},
            {"customer_billing_address": {"country": "FR"}, "customer_tax_id": "123"},
        ),
    )
    async def test_invalid_tax_id(
        self,
        payload: dict[str, Any],
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate.model_validate(
                    {
                        "payment_processor": PaymentProcessor.stripe,
                        "product_price_id": price.id,
                        **payload,
                    }
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_not_existing_subscription(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
                    product_price_id=price.id,
                    subscription_id=uuid.uuid4(),
                    metadata={"key": "value"},
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_not_existing_discount(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
                    product_price_id=price.id,
                    discount_id=uuid.uuid4(),
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_not_applicable_discount(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time_free_price: Product,
        discount_fixed_once: Discount,
    ) -> None:
        price = product_one_time_free_price.prices[0]
        assert isinstance(price, ProductPriceFree)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
                    product_price_id=price.id,
                    discount_id=discount_fixed_once.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_paid_subscription(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
                    product_price_id=price.id,
                    subscription_id=subscription.id,
                    metadata={"key": "value"},
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize("amount", [None, 4242])
    async def test_valid_fixed_price(
        self,
        amount: int | None,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                amount=amount,
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time
        assert checkout.products == [product_one_time]
        assert checkout.amount == price.price_amount
        assert checkout.currency == price.price_currency
        assert checkout.user_metadata == {"key": "value"}

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize("amount", [None, 4242])
    async def test_valid_free_price(
        self,
        amount: int | None,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time_free_price: Product,
    ) -> None:
        price = product_one_time_free_price.prices[0]
        assert isinstance(price, ProductPriceFree)
        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                amount=amount,
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_free_price
        assert checkout.products == [product_one_time_free_price]
        assert checkout.amount is None
        assert checkout.currency is None
        assert checkout.user_metadata == {"key": "value"}

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
            CheckoutPriceCreate(
                product_price_id=price.id,
                amount=amount,
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_custom_price
        assert checkout.products == [product_one_time_custom_price]
        if amount is None:
            assert checkout.amount == price.preset_amount
        else:
            assert checkout.amount == amount
        assert checkout.currency == price.price_currency
        assert checkout.user_metadata == {"key": "value"}

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_tax_id(
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
            CheckoutPriceCreate(
                product_price_id=price.id,
                customer_billing_address=Address.model_validate({"country": "FR"}),
                customer_tax_id="FR61954506077",
            ),
            auth_subject,
        )

        assert checkout.customer_tax_id == ("FR61954506077", TaxIDFormat.eu_vat)
        assert checkout.customer_tax_id_number == "FR61954506077"

    @pytest.mark.auth
    async def test_valid_success_url_with_interpolation(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                success_url=HttpUrl(
                    "https://example.com/success?checkout_id={CHECKOUT_ID}"
                ),
            ),
            auth_subject,
        )

        assert (
            checkout.success_url
            == f"https://example.com/success?checkout_id={checkout.id}"
        )

    @pytest.mark.auth
    async def test_valid_success_url_with_invalid_interpolation_variable(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                success_url=HttpUrl(
                    "https://example.com/success?checkout_id={CHECKOUT_SESSION_ID}"
                ),
            ),
            auth_subject,
        )

        assert (
            checkout.success_url
            == "https://example.com/success?checkout_id={CHECKOUT_SESSION_ID}"
        )

    async def test_silent_calculate_tax_error(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        calculate_tax_mock: AsyncMock,
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        calculate_tax_mock.side_effect = IncompleteTaxLocation(
            stripe_lib.InvalidRequestError("ERROR", "ERROR")
        )

        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                customer_billing_address=Address.model_validate({"country": "US"}),
            ),
            auth_subject,
        )

        assert checkout.tax_amount is None
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "US"

    async def test_valid_calculate_tax(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        calculate_tax_mock: AsyncMock,
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        calculate_tax_mock.return_value = 100

        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                customer_billing_address=Address.model_validate({"country": "FR"}),
            ),
            auth_subject,
        )

        assert checkout.tax_amount == 100
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "FR"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_subscription_upgrade(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product_recurring_free_price, customer=customer
        )

        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                subscription_id=subscription.id,
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product
        assert checkout.subscription == subscription

    @pytest.mark.parametrize(
        "custom_field_data",
        (pytest.param({"text": "abc", "select": "c"}, id="invalid select"),),
    )
    async def test_invalid_custom_field_data(
        self,
        custom_field_data: dict[str, Any],
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_custom_fields: Product,
    ) -> None:
        price = product_custom_fields.prices[0]
        assert isinstance(price, ProductPriceFixed)

        with pytest.raises(PolarRequestValidationError) as e:
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
                    product_price_id=price.id,
                    custom_field_data=custom_field_data,
                ),
                auth_subject,
            )

        for error in e.value.errors():
            assert error["loc"][0:2] == ("body", "custom_field_data")

    async def test_valid_custom_field_data(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_custom_fields: Product,
    ) -> None:
        price = product_custom_fields.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                custom_field_data={"text": "abc", "select": "a"},
            ),
            auth_subject,
        )

        assert checkout.custom_field_data == {"text": "abc", "select": "a"}

    async def test_valid_missing_required_custom_field(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_custom_fields: Product,
    ) -> None:
        price = product_custom_fields.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id, custom_field_data={"text": "abc"}
            ),
            auth_subject,
        )

        assert checkout.custom_field_data == {"text": "abc", "select": None}

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize("amount", [None, 4242])
    async def test_valid_embed_origin(
        self,
        amount: int | None,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                amount=amount,
                embed_origin="https://example.com",
            ),
            auth_subject,
        )

        assert checkout.embed_origin == "https://example.com"

    async def test_valid_tax_not_applicable(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_tax_not_applicable: Product,
    ) -> None:
        price = product_tax_not_applicable.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                customer_billing_address=Address.model_validate({"country": "FR"}),
            ),
            auth_subject,
        )

        assert checkout.tax_amount == 0
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "FR"

    async def test_valid_discount(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
        discount_fixed_once: Discount,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                discount_id=discount_fixed_once.id,
            ),
            auth_subject,
        )

        assert checkout.discount == discount_fixed_once
        assert checkout.amount == price.price_amount
        assert (
            checkout.subtotal_amount
            == price.price_amount
            - discount_fixed_once.get_discount_amount(price.price_amount)
        )

    @pytest.mark.auth
    async def test_product_not_existing(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutProductCreate(
                    product_id=uuid.uuid4(),
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second"),
        AuthSubjectFixture(subject="organization_second"),
    )
    async def test_product_not_writable(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutProductCreate(
                    product_id=product_one_time.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_product_archived(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
    ) -> None:
        product_one_time.is_archived = True
        await save_fixture(product_one_time)
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutProductCreate(
                    product_id=product_one_time.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_product_valid(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
        user_organization: UserOrganization,
    ) -> None:
        checkout = await checkout_service.create(
            session,
            CheckoutProductCreate(
                product_id=product_one_time.id,
            ),
            auth_subject,
        )

        assert checkout.product == product_one_time
        assert checkout.product_price == product_one_time.prices[0]
        assert checkout.products == [product_one_time]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_products_archived(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        product_one_time: Product,
    ) -> None:
        product_one_time.is_archived = True
        await save_fixture(product_one_time)
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutProductsCreate(products=[product_one_time.id, product.id]),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
    )
    async def test_products_different_organizations(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        product: Product,
        product_organization_second: Product,
        organization_second: Organization,
    ) -> None:
        user_organization = UserOrganization(
            user_id=user.id, organization_id=organization_second.id
        )
        await save_fixture(user_organization)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutProductsCreate(
                    products=[product.id, product_organization_second.id]
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_products_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        product_one_time: Product,
        product_one_time_custom_price: Product,
    ) -> None:
        checkout = await checkout_service.create(
            session,
            CheckoutProductsCreate(
                products=[
                    product.id,
                    product_one_time.id,
                    product_one_time_custom_price.id,
                ]
            ),
            auth_subject,
        )

        assert checkout.products == [
            product,
            product_one_time,
            product_one_time_custom_price,
        ]
        assert checkout.product == product
        assert checkout.product_price == product.prices[0]

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_customer(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(
                session,
                CheckoutPriceCreate(
                    product_price_id=price.id,
                    customer_id=uuid.uuid4(),
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_customer(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)

        checkout = await checkout_service.create(
            session,
            CheckoutPriceCreate(
                product_price_id=price.id,
                customer_id=customer.id,
            ),
            auth_subject,
        )

        assert checkout.customer == customer
        assert checkout.customer_email == customer.email
        assert checkout.customer_name == customer.name
        assert checkout.customer_billing_address == customer.billing_address
        assert checkout.customer_tax_id == customer.tax_id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_customer_metadata(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
        user_organization: UserOrganization,
    ) -> None:
        checkout = await checkout_service.create(
            session,
            CheckoutProductCreate(
                product_id=product_one_time.id,
                customer_metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout.customer_metadata == {"key": "value"}


@pytest.mark.asyncio
class TestClientCreate:
    async def test_not_existing_product(
        self, session: AsyncSession, auth_subject: AuthSubject[Anonymous]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.client_create(
                session,
                CheckoutCreatePublic(product_id=uuid.uuid4()),
                auth_subject,
            )

    async def test_archived_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous],
        product_one_time: Product,
    ) -> None:
        product_one_time.is_archived = True
        await save_fixture(product_one_time)
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.client_create(
                session,
                CheckoutCreatePublic(product_id=product_one_time.id),
                auth_subject,
            )

    async def test_valid_fixed_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous],
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.client_create(
            session, CheckoutCreatePublic(product_id=product_one_time.id), auth_subject
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time
        assert checkout.amount == price.price_amount
        assert checkout.currency == price.price_currency

    async def test_valid_free_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous],
        product_one_time_free_price: Product,
    ) -> None:
        price = product_one_time_free_price.prices[0]
        assert isinstance(price, ProductPriceFree)
        checkout = await checkout_service.client_create(
            session,
            CheckoutCreatePublic(product_id=product_one_time_free_price.id),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_free_price
        assert checkout.amount is None
        assert checkout.currency is None

    async def test_valid_custom_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous],
        product_one_time_custom_price: Product,
    ) -> None:
        price = product_one_time_custom_price.prices[0]
        assert isinstance(price, ProductPriceCustom)
        price.preset_amount = 4242

        checkout = await checkout_service.client_create(
            session,
            CheckoutCreatePublic(product_id=product_one_time_custom_price.id),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_custom_price
        assert checkout.amount == price.preset_amount
        assert checkout.currency == price.price_currency


@pytest.mark.asyncio
class TestCheckoutLinkCreate:
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_one_time],
            success_url="https://example.com/success",
            user_metadata={"key": "value"},
        )
        checkout = await checkout_service.checkout_link_create(session, checkout_link)

        assert checkout.product_price == price
        assert checkout.product == product_one_time
        assert checkout.products == [product_one_time]
        assert checkout.success_url == "https://example.com/success"
        assert checkout.user_metadata == {"key": "value"}

    async def test_valid_with_discount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        discount_fixed_once: Discount,
    ) -> None:
        price = product_one_time.prices[0]
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_one_time],
            discount=discount_fixed_once,
        )

        checkout = await checkout_service.checkout_link_create(session, checkout_link)

        assert checkout.discount == discount_fixed_once


@pytest.mark.asyncio
class TestUpdate:
    async def test_not_existing_product(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_fixed,
                CheckoutUpdate(
                    product_id=uuid.uuid4(),
                ),
            )

    async def test_product_not_on_checkout(
        self,
        session: AsyncSession,
        locker: Locker,
        product_one_time_custom_price: Product,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_fixed,
                CheckoutUpdate(product_id=product_one_time_custom_price.id),
            )

    @pytest.mark.parametrize("amount", [10, 20_000_000_000])
    async def test_amount_update_max_limits(
        self,
        amount: int,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_custom: Checkout,
    ) -> None:
        with pytest.raises(ValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_custom,
                CheckoutUpdate(
                    amount=amount,
                ),
            )

    @pytest.mark.parametrize("amount", [500, 10000])
    async def test_amount_update_invalid_limits(
        self,
        amount: int,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
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
                locker,
                checkout_one_time_custom,
                CheckoutUpdate(
                    amount=amount,
                ),
            )

    async def test_not_open(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_confirmed_one_time: Checkout,
    ) -> None:
        with pytest.raises(NotOpenCheckout):
            await checkout_service.update(
                session,
                locker,
                checkout_confirmed_one_time,
                CheckoutUpdate(
                    customer_email="customer@example.com",
                ),
            )

    @pytest.mark.parametrize(
        "initial_values,updated_values",
        [
            ({"customer_billing_address": None}, {"customer_tax_id": "FR61954506077"}),
            (
                {
                    "customer_tax_id": ("FR61954506077", TaxIDFormat.eu_vat),
                    "customer_billing_address": {"country": "FR"},
                },
                {"customer_billing_address": {"country": "US"}},
            ),
            (
                {},
                {
                    "customer_tax_id": "123",
                    "customer_billing_address": {"country": "FR"},
                },
            ),
        ],
    )
    async def test_invalid_tax_id(
        self,
        initial_values: dict[str, Any],
        updated_values: dict[str, Any],
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        checkout_recurring_fixed: Checkout,
    ) -> None:
        for key, value in initial_values.items():
            setattr(checkout_recurring_fixed, key, value)
        await save_fixture(checkout_recurring_fixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_recurring_fixed,
                CheckoutUpdate.model_validate(updated_values),
            )

    async def test_invalid_discount_id(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_fixed,
                CheckoutUpdate(
                    discount_id=uuid.uuid4(),
                ),
            )

    async def test_invalid_discount_code(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_fixed,
                CheckoutUpdatePublic(
                    discount_code="invalid",
                ),
            )

    async def test_invalid_discount_id_not_applicable(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_free: Checkout,
        discount_fixed_once: Discount,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_free,
                CheckoutUpdate(discount_id=discount_fixed_once.id),
            )

    async def test_invalid_discount_code_not_applicable(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_free: Checkout,
        discount_fixed_once: Discount,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_free,
                CheckoutUpdatePublic(discount_code=discount_fixed_once.code),
            )

    async def test_invalid_recurring_discount_on_one_time_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
        organization: Organization,
    ) -> None:
        recurring_discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            code="RECURRING",
            amount=1000,
            currency="usd",
            duration=DiscountDuration.repeating,
            duration_in_months=12,
            organization=organization,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                locker,
                checkout_one_time_fixed,
                CheckoutUpdatePublic(discount_code=recurring_discount.code),
            )

    async def test_valid_product_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        checkout_recurring_fixed: Checkout,
    ) -> None:
        new_product = await create_product(
            save_fixture,
            organization=product.organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(4242,)],
        )
        checkout_recurring_fixed.checkout_products.append(
            CheckoutProduct(product=new_product, order=1)
        )
        await save_fixture(checkout_recurring_fixed)

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_recurring_fixed,
            CheckoutUpdate(
                product_id=new_product.id,
            ),
        )

        new_price = new_product.prices[0]
        assert isinstance(new_price, ProductPriceFixed)

        assert checkout.product_price == new_price
        assert checkout.product == new_product
        assert checkout.amount == new_price.price_amount
        assert checkout.currency == new_price.price_currency

    async def test_valid_product_change_not_applicable_discount(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        product: Product,
        checkout_recurring_fixed: Checkout,
    ) -> None:
        """
        If the Checkout has a discount that is not applicable to the new product,
        the discount should be removed.
        """
        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amount=1000,
            currency="usd",
            duration=DiscountDuration.forever,
            organization=product.organization,
            products=[product],
        )
        new_product = await create_product(
            save_fixture,
            organization=product.organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(4242,)],
        )

        checkout_recurring_fixed.checkout_products.append(
            CheckoutProduct(product=new_product, order=1)
        )
        checkout_recurring_fixed.discount = discount
        await save_fixture(checkout_recurring_fixed)

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_recurring_fixed,
            CheckoutUpdate(
                product_id=new_product.id,
            ),
        )

        new_price = new_product.prices[0]
        assert isinstance(new_price, ProductPriceFixed)

        assert checkout.product_price == new_price
        assert checkout.product == new_product
        assert checkout.amount == new_price.price_amount
        assert checkout.currency == new_price.price_currency
        assert checkout.discount is None

    async def test_valid_fixed_price_amount_update(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_fixed,
            CheckoutUpdate(
                amount=4242,
            ),
        )

        price = checkout_one_time_fixed.product_price
        assert isinstance(price, ProductPriceFixed)
        assert checkout.amount == price.price_amount

    async def test_valid_custom_price_amount_update(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_custom,
            CheckoutUpdate(
                amount=4242,
            ),
        )
        assert checkout.amount == 4242

    async def test_valid_free_price_amount_update(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_free,
            CheckoutUpdate(
                amount=4242,
            ),
        )

        price = checkout_one_time_free.product_price
        assert isinstance(price, ProductPriceFree)
        assert checkout.amount is None

    async def test_valid_tax_id(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_custom,
            CheckoutUpdate(
                customer_billing_address=Address.model_validate({"country": "FR"}),
                customer_tax_id="FR61954506077",
            ),
        )

        assert checkout.customer_tax_id == ("FR61954506077", TaxIDFormat.eu_vat)
        assert checkout.customer_tax_id_number == "FR61954506077"

    async def test_valid_unset_tax_id(
        self,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout_one_time_custom.customer_tax_id = ("FR61954506077", TaxIDFormat.eu_vat)
        await save_fixture(checkout_one_time_custom)

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_custom,
            CheckoutUpdate(
                customer_billing_address=Address.model_validate({"country": "US"}),
                customer_tax_id=None,
            ),
        )

        assert checkout.customer_tax_id is None
        assert checkout.customer_tax_id_number is None
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "US"

    async def test_silent_calculate_tax_error(
        self,
        session: AsyncSession,
        locker: Locker,
        calculate_tax_mock: AsyncMock,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        calculate_tax_mock.side_effect = IncompleteTaxLocation(
            stripe_lib.InvalidRequestError("ERROR", "ERROR")
        )

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_fixed,
            CheckoutUpdate(
                customer_billing_address=Address.model_validate({"country": "US"}),
            ),
        )

        assert checkout.tax_amount is None
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "US"

    async def test_valid_calculate_tax(
        self,
        session: AsyncSession,
        locker: Locker,
        calculate_tax_mock: AsyncMock,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        calculate_tax_mock.return_value = 100

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_fixed,
            CheckoutUpdate(
                customer_billing_address=Address.model_validate({"country": "FR"}),
            ),
        )

        assert checkout.tax_amount == 100
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "FR"

    async def test_ignore_email_update_if_customer_set(
        self,
        session: AsyncSession,
        locker: Locker,
        save_fixture: SaveFixture,
        customer: Customer,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        checkout_one_time_fixed.customer = customer
        checkout_one_time_fixed.customer_email = customer.email
        await save_fixture(checkout_one_time_fixed)

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_fixed,
            CheckoutUpdate(customer_email="updatedemail@example.com"),
        )

        assert checkout.customer_email == customer.email

    async def test_valid_metadata(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_free,
            CheckoutUpdate(
                metadata={"key": "value"},
            ),
        )

        assert checkout.user_metadata == {"key": "value"}

    async def test_valid_customer_metadata(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_free,
            CheckoutUpdate(
                customer_metadata={"key": "value"},
            ),
        )

        assert checkout.customer_metadata == {"key": "value"}

    @pytest.mark.parametrize(
        "custom_field_data",
        (pytest.param({"text": "abc", "select": "c"}, id="invalid select"),),
    )
    async def test_invalid_custom_field_data(
        self,
        custom_field_data: dict[str, Any],
        session: AsyncSession,
        locker: Locker,
        checkout_custom_fields: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError) as e:
            await checkout_service.update(
                session,
                locker,
                checkout_custom_fields,
                CheckoutUpdate(custom_field_data=custom_field_data),
            )

        for error in e.value.errors():
            assert error["loc"][0:2] == ("body", "custom_field_data")

    async def test_valid_custom_field_data(
        self, session: AsyncSession, locker: Locker, checkout_custom_fields: Checkout
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_custom_fields,
            CheckoutUpdate(
                custom_field_data={"text": "abc", "select": "a"},
            ),
        )

        assert checkout.custom_field_data == {"text": "abc", "select": "a"}

    async def test_valid_missing_required_custom_field(
        self, session: AsyncSession, locker: Locker, checkout_custom_fields: Checkout
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_custom_fields,
            CheckoutUpdate(
                custom_field_data={"text": "abc"},
            ),
        )

        assert checkout.custom_field_data == {"text": "abc", "select": None}

    async def test_valid_embed_origin(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_free,
            CheckoutUpdate(
                embed_origin="https://example.com",
            ),
        )

        assert checkout.embed_origin == "https://example.com"

    async def test_valid_tax_not_applicable(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_tax_not_applicable: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_tax_not_applicable,
            CheckoutUpdate(
                customer_billing_address=Address.model_validate({"country": "FR"}),
            ),
        )

        assert checkout.tax_amount == 0
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "FR"

    async def test_valid_discount_id(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
        discount_fixed_once: Discount,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_fixed,
            CheckoutUpdate(
                discount_id=discount_fixed_once.id,
            ),
        )

        assert checkout.discount == discount_fixed_once

        price = checkout_one_time_fixed.product_price
        assert isinstance(price, ProductPriceFixed)
        assert checkout.amount == price.price_amount
        assert (
            checkout.subtotal_amount
            == price.price_amount
            - discount_fixed_once.get_discount_amount(price.price_amount)
        )

    async def test_valid_discount_code(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout_one_time_fixed: Checkout,
        discount_fixed_once: Discount,
    ) -> None:
        checkout = await checkout_service.update(
            session,
            locker,
            checkout_one_time_fixed,
            CheckoutUpdatePublic(
                discount_code=discount_fixed_once.code,
            ),
        )

        assert checkout.discount == discount_fixed_once

        price = checkout_one_time_fixed.product_price
        assert isinstance(price, ProductPriceFixed)
        assert checkout.amount == price.price_amount
        assert (
            checkout.subtotal_amount
            == price.price_amount
            - discount_fixed_once.get_discount_amount(price.price_amount)
        )

    async def test_multiple_subscriptions_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        checkout_recurring_fixed: Checkout,
        customer: Customer,
    ) -> None:
        organization.subscription_settings = {
            **organization.subscription_settings,
            "allow_multiple_subscriptions": True,
        }
        await save_fixture(organization)

        await create_active_subscription(
            save_fixture, product=checkout_recurring_fixed.product, customer=customer
        )

        checkout = await checkout_service.update(
            session,
            locker,
            checkout_recurring_fixed,
            CheckoutUpdate(customer_email=customer.email),
        )

        assert checkout.customer_email == customer.email

    async def test_multiple_subscriptions_forbidden(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        organization: Organization,
        checkout_recurring_fixed: Checkout,
        customer: Customer,
    ) -> None:
        organization.subscription_settings = {
            **organization.subscription_settings,
            "allow_multiple_subscriptions": False,
        }
        await save_fixture(organization)

        await create_active_subscription(
            save_fixture, product=checkout_recurring_fixed.product, customer=customer
        )

        # With email update
        with pytest.raises(AlreadyActiveSubscriptionError):
            await checkout_service.update(
                session,
                locker,
                checkout_recurring_fixed,
                CheckoutUpdate(customer_email=customer.email),
            )

        # With customer ID set
        checkout_recurring_fixed.customer = customer
        await save_fixture(checkout_recurring_fixed)

        with pytest.raises(AlreadyActiveSubscriptionError):
            await checkout_service.update(
                session, locker, checkout_recurring_fixed, CheckoutUpdate()
            )


@pytest.mark.asyncio
class TestConfirm:
    async def test_missing_amount_on_custom_price(
        self,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_custom: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
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

    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"confirmation_token_id": "CONFIRMATION_TOKEN_ID"},
        ],
    )
    async def test_missing_required_field(
        self,
        payload: dict[str, str],
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
                checkout_one_time_fixed,
                CheckoutConfirmStripe.model_validate(payload),
            )

    async def test_not_open(
        self,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_confirmed_one_time: Checkout,
    ) -> None:
        with pytest.raises(NotOpenCheckout):
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
                checkout_confirmed_one_time,
                CheckoutConfirmStripe.model_validate(
                    {"confirmation_token_id": "CONFIRMATION_TOKEN_ID"}
                ),
            )

    async def test_archived_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_fixed: Checkout,
    ) -> None:
        archived_price = await create_product_price_fixed(
            save_fixture, product=checkout_one_time_fixed.product, is_archived=True
        )
        checkout_one_time_fixed.product_price = archived_price
        await save_fixture(checkout_one_time_fixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
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

    async def test_missing_required_custom_field(
        self,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_custom_fields: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
                checkout_custom_fields,
                CheckoutConfirmStripe.model_validate(
                    {
                        "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                        "customer_name": "Customer Name",
                        "customer_email": "customer@example.com",
                        "customer_billing_address": {"country": "FR"},
                        "custom_field_data": {"text": "abc"},
                    }
                ),
            )

    async def test_validate_custom_fields_even_if_data_unset(
        self,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_custom_fields: Checkout,
    ) -> None:
        """
        We had a bug where the custom fields validation was actually bypassed
        if the data was unset.
        """
        with pytest.raises(PolarRequestValidationError) as e:
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
                checkout_custom_fields,
                CheckoutConfirmStripe.model_validate(
                    {
                        "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                        "customer_name": "Customer Name",
                        "customer_email": "customer@example.com",
                        "customer_billing_address": {"country": "FR"},
                    }
                ),
            )

    async def test_calculate_tax_error(
        self,
        calculate_tax_mock: AsyncMock,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_fixed: Checkout,
    ) -> None:
        calculate_tax_mock.side_effect = IncompleteTaxLocation(
            stripe_lib.InvalidRequestError("ERROR", "ERROR")
        )

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                locker,
                auth_subject,
                checkout_one_time_fixed,
                CheckoutConfirmStripe.model_validate(
                    {
                        "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                        "customer_name": "Customer Name",
                        "customer_email": "customer@example.com",
                        "customer_billing_address": {"country": "US"},
                    }
                ),
            )

    @pytest.mark.parametrize(
        "customer_billing_address,expected_tax_metadata",
        [
            ({"country": "FR"}, {"tax_country": "FR"}),
            (
                {"country": "CA", "state": "CA-QC"},
                {"tax_country": "CA", "tax_state": "QC"},
            ),
        ],
    )
    async def test_valid_stripe(
        self,
        save_fixture: SaveFixture,
        customer_billing_address: dict[str, str],
        expected_tax_metadata: dict[str, str],
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_fixed: Checkout,
    ) -> None:
        checkout_one_time_fixed.customer_metadata = {"key": "value"}
        await save_fixture(checkout_one_time_fixed)

        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )
        checkout = await checkout_service.confirm(
            session,
            locker,
            auth_subject,
            checkout_one_time_fixed,
            CheckoutConfirmStripe.model_validate(
                {
                    "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                    "customer_name": "Customer Name",
                    "customer_email": "customer@example.com",
                    "customer_billing_address": customer_billing_address,
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.payment_processor_metadata == {
            "intent_client_secret": "CLIENT_SECRET",
            "intent_status": "succeeded",
            "customer_id": "STRIPE_CUSTOMER_ID",
        }

        stripe_service_mock.create_customer.assert_called_once()
        stripe_service_mock.create_payment_intent.assert_called_once()
        assert stripe_service_mock.create_payment_intent.call_args[1]["metadata"] == {
            "checkout_id": str(checkout.id),
            "type": ProductType.product,
            "tax_amount": "0",
            **expected_tax_metadata,
        }

        assert checkout.customer is not None
        assert checkout.customer.user_metadata == {"key": "value"}

        assert checkout.customer_session_token is not None
        customer_session = await customer_session_service.get_by_token(
            session, checkout.customer_session_token
        )
        assert customer_session is not None
        assert customer_session.customer == checkout.customer

    @pytest.mark.parametrize(
        "customer_billing_address,expected_tax_metadata",
        [
            ({"country": "FR"}, {"tax_country": "FR"}),
            (
                {"country": "CA", "state": "CA-QC"},
                {"tax_country": "CA", "tax_state": "QC"},
            ),
        ],
    )
    async def test_valid_fully_discounted_subscription(
        self,
        customer_billing_address: dict[str, str],
        expected_tax_metadata: dict[str, str],
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_discount_percentage_100: Checkout,
        discount_percentage_100: Discount,
    ) -> None:
        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
        stripe_service_mock.create_setup_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )
        checkout = await checkout_service.confirm(
            session,
            locker,
            auth_subject,
            checkout_discount_percentage_100,
            CheckoutConfirmStripe.model_validate(
                {
                    "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                    "customer_name": "Customer Name",
                    "customer_email": "customer@example.com",
                    "customer_billing_address": customer_billing_address,
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.payment_processor_metadata == {
            "intent_client_secret": "CLIENT_SECRET",
            "intent_status": "succeeded",
            "customer_id": "STRIPE_CUSTOMER_ID",
        }

        stripe_service_mock.create_customer.assert_called_once()
        stripe_service_mock.create_setup_intent.assert_called_once()
        assert stripe_service_mock.create_setup_intent.call_args[1]["metadata"] == {
            "checkout_id": str(checkout.id),
            "type": ProductType.product,
            "tax_amount": "0",
            **expected_tax_metadata,
        }

        updated_discount = await discount_service.get(
            session,
            discount_percentage_100.id,
            options=(joinedload(Discount.discount_redemptions),),
        )
        assert updated_discount is not None
        assert len(updated_discount.discount_redemptions) == 1
        assert updated_discount.discount_redemptions[0].checkout_id == checkout.id

    async def test_valid_custom_pricing_discount(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_custom: Checkout,
        discount_percentage_50: Discount,
    ) -> None:
        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )
        checkout = await checkout_service.confirm(
            session,
            locker,
            auth_subject,
            checkout_one_time_custom,
            CheckoutConfirmStripe.model_validate(
                {
                    "amount": 2000,
                    "discount_code": discount_percentage_50.code,
                    "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                    "customer_name": "Customer Name",
                    "customer_email": "customer@example.com",
                    "customer_billing_address": {"country": "FR"},
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.payment_processor_metadata == {
            "intent_client_secret": "CLIENT_SECRET",
            "intent_status": "succeeded",
            "customer_id": "STRIPE_CUSTOMER_ID",
        }
        assert checkout.total_amount == 1000

        stripe_service_mock.create_customer.assert_called_once()
        stripe_service_mock.create_payment_intent.assert_called_once()
        assert stripe_service_mock.create_payment_intent.call_args[1]["metadata"] == {
            "checkout_id": str(checkout.id),
            "type": ProductType.product,
            "tax_amount": "0",
            "tax_country": "FR",
        }

        updated_discount = await discount_service.get(
            session,
            discount_percentage_50.id,
            options=(joinedload(Discount.discount_redemptions),),
        )
        assert updated_discount is not None
        assert len(updated_discount.discount_redemptions) == 1
        assert updated_discount.discount_redemptions[0].checkout_id == checkout.id

    async def test_valid_stripe_free(
        self,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_free: Checkout,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.checkout.service.enqueue_job")

        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )

        checkout = await checkout_service.confirm(
            session,
            locker,
            auth_subject,
            checkout_one_time_free,
            CheckoutConfirmStripe.model_validate(
                {
                    "customer_name": "Customer Name",
                    "customer_email": "customer@example.com",
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.payment_processor_metadata == {
            "customer_id": "STRIPE_CUSTOMER_ID"
        }

        stripe_service_mock.create_customer.assert_called_once()
        stripe_service_mock.create_payment_intent.assert_not_called()

        enqueue_job_mock.assert_called_once_with(
            "checkout.handle_free_success", checkout_id=checkout.id
        )

    async def test_valid_stripe_existing_customer(
        self,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        organization: Organization,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            stripe_customer_id="CHECKOUT_CUSTOMER_ID",
            user_metadata={"key": "value"},
        )
        checkout_one_time_fixed.customer = customer
        checkout_one_time_fixed.customer_email = customer.email
        checkout_one_time_fixed.customer_metadata = {"key": "updated", "key2": "value2"}
        await save_fixture(checkout_one_time_fixed)

        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )

        checkout = await checkout_service.confirm(
            session,
            locker,
            auth_subject,
            checkout_one_time_fixed,
            CheckoutConfirmStripe.model_validate(
                {
                    "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                    "customer_name": "Customer Name",
                    "customer_billing_address": {"country": "FR"},
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        stripe_service_mock.update_customer.assert_called_once()

        assert checkout.customer is not None
        assert checkout.customer.user_metadata == {"key": "updated", "key2": "value2"}

    async def test_valid_stripe_existing_customer_email(
        self,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[Anonymous],
        checkout_one_time_fixed: Checkout,
        customer: Customer,
    ) -> None:
        customer.user_metadata = {"key": "value"}
        await save_fixture(customer)

        checkout_one_time_fixed.customer_metadata = {"key": "updated", "key2": "value2"}

        stripe_service_mock.create_payment_intent.return_value = SimpleNamespace(
            client_secret="CLIENT_SECRET", status="succeeded"
        )

        checkout = await checkout_service.confirm(
            session,
            locker,
            auth_subject,
            checkout_one_time_fixed,
            CheckoutConfirmStripe.model_validate(
                {
                    "confirmation_token_id": "CONFIRMATION_TOKEN_ID",
                    "customer_email": customer.email,
                    "customer_name": "Customer Name",
                    "customer_billing_address": {"country": "FR"},
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.customer is not None
        assert checkout.customer == customer
        assert checkout.customer.user_metadata == {"key": "updated", "key2": "value2"}
        stripe_service_mock.update_customer.assert_called_once()


def build_stripe_payment_intent(
    *,
    amount: int = 0,
    status: str = "succeeded",
    customer: str | None = "CUSTOMER_ID",
    payment_method: str | None = "PAYMENT_METHOD_ID",
) -> stripe_lib.PaymentIntent:
    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "STRIPE_PAYMENT_INTENT_ID",
            "amount": amount,
            "status": status,
            "customer": customer,
            "payment_method": payment_method,
        },
        None,
    )


@pytest.mark.asyncio
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
        stripe_service_mock.create_out_of_band_invoice.return_value = SimpleNamespace(
            id="STRIPE_INVOICE_ID", total=checkout_confirmed_one_time.total_amount
        )

        checkout = await checkout_service.handle_stripe_success(
            session,
            checkout_confirmed_one_time.id,
            build_stripe_payment_intent(
                amount=checkout_confirmed_one_time.total_amount or 0
            ),
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
        stripe_service_mock.create_out_of_band_subscription.return_value = (
            SimpleNamespace(id="STRIPE_SUBSCRIPTION_ID"),
            SimpleNamespace(
                id="STRIPE_INVOICE_ID", total=checkout_confirmed_recurring.total_amount
            ),
        )

        checkout = await checkout_service.handle_stripe_success(
            session,
            checkout_confirmed_recurring.id,
            build_stripe_payment_intent(
                amount=checkout_confirmed_recurring.total_amount or 0
            ),
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
        stripe_service_mock.create_out_of_band_invoice.return_value = SimpleNamespace(
            id="STRIPE_INVOICE_ID", total=4242
        )
        checkout = await checkout_service.handle_stripe_success(
            session,
            checkout_one_time_custom.id,
            build_stripe_payment_intent(amount=4242),
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_price_for_product.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_not_called()

        stripe_service_mock.create_out_of_band_invoice.assert_called_once()
        assert (
            stripe_service_mock.create_out_of_band_invoice.call_args[1]["price"]
            == "STRIPE_CUSTOM_PRICE_ID"
        )

    async def test_valid_recurring_upgrade(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        checkout_confirmed_recurring_upgrade: Checkout,
    ) -> None:
        stripe_service_mock.update_out_of_band_subscription.return_value = (
            SimpleNamespace(id="STRIPE_SUBSCRIPTION_ID"),
            SimpleNamespace(
                id="STRIPE_INVOICE_ID",
                total=checkout_confirmed_recurring_upgrade.total_amount,
            ),
        )

        checkout = await checkout_service.handle_stripe_success(
            session,
            checkout_confirmed_recurring_upgrade.id,
            build_stripe_payment_intent(
                amount=checkout_confirmed_recurring_upgrade.total_amount or 0
            ),
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.update_out_of_band_subscription.assert_called_once()
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()
        stripe_service_mock.create_out_of_band_invoice.assert_not_called()


@pytest.mark.asyncio
class TestHandleStripeFailure:
    async def test_not_existing_checkout(self, session: AsyncSession) -> None:
        with pytest.raises(CheckoutDoesNotExist):
            await checkout_service.handle_stripe_failure(
                session,
                uuid.uuid4(),
                build_stripe_payment_intent(),
            )

    async def test_not_confirmed_checkout(
        self, session: AsyncSession, checkout_one_time_fixed: Checkout
    ) -> None:
        checkout = await checkout_service.handle_stripe_failure(
            session,
            checkout_one_time_fixed.id,
            build_stripe_payment_intent(),
        )

        assert checkout.status == CheckoutStatus.open

    async def test_valid(
        self, session: AsyncSession, checkout_confirmed_one_time: Checkout
    ) -> None:
        checkout = await checkout_service.handle_stripe_failure(
            session,
            checkout_confirmed_one_time.id,
            build_stripe_payment_intent(),
        )

        assert checkout.status == CheckoutStatus.failed

    async def test_valid_with_redemption(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        checkout_confirmed_one_time: Checkout,
        discount_fixed_once: Discount,
    ) -> None:
        discount_redemption = DiscountRedemption(
            discount=discount_fixed_once,
            checkout=checkout_confirmed_one_time,
        )
        await save_fixture(discount_redemption)

        checkout = await checkout_service.handle_stripe_failure(
            session,
            checkout_confirmed_one_time.id,
            build_stripe_payment_intent(),
        )

        assert checkout.status == CheckoutStatus.failed

        discount_redemption_repository = DiscountRedemptionRepository.from_session(
            session
        )
        assert (
            await discount_redemption_repository.get_by_id(discount_redemption.id)
            is None
        )


@pytest.mark.asyncio
class TestHandleFreeSuccess:
    async def test_not_existing_checkout(self, session: AsyncSession) -> None:
        with pytest.raises(CheckoutDoesNotExist):
            await checkout_service.handle_free_success(session, uuid.uuid4())

    async def test_not_confirmed_checkout(
        self, session: AsyncSession, checkout_one_time_free: Checkout
    ) -> None:
        with pytest.raises(NotConfirmedCheckout):
            await checkout_service.handle_free_success(
                session, checkout_one_time_free.id
            )

    async def test_no_customer_on_checkout(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout_one_time_free.status = CheckoutStatus.confirmed
        await save_fixture(checkout_one_time_free)

        with pytest.raises(NoCustomerOnCheckout):
            await checkout_service.handle_free_success(
                session, checkout_one_time_free.id
            )

    async def test_payment_required(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        checkout_confirmed_one_time: Checkout,
    ) -> None:
        checkout_confirmed_one_time.payment_processor_metadata = {
            "customer_id": "STRIPE_CUSTOMER_ID"
        }
        await save_fixture(checkout_confirmed_one_time)

        with pytest.raises(PaymentRequired):
            await checkout_service.handle_free_success(
                session, checkout_confirmed_one_time.id
            )

    async def test_valid_one_time(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout_one_time_free.status = CheckoutStatus.confirmed
        checkout_one_time_free.payment_processor_metadata = {
            "customer_id": "STRIPE_CUSTOMER_ID"
        }
        await save_fixture(checkout_one_time_free)

        checkout = await checkout_service.handle_free_success(
            session, checkout_one_time_free.id
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_out_of_band_invoice.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_not_called()

    async def test_valid_recurring(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        checkout_recurring_free: Checkout,
    ) -> None:
        checkout_recurring_free.status = CheckoutStatus.confirmed
        checkout_recurring_free.payment_processor_metadata = {
            "customer_id": "STRIPE_CUSTOMER_ID"
        }
        await save_fixture(checkout_recurring_free)

        stripe_service_mock.create_out_of_band_subscription.return_value = (
            SimpleNamespace(id="STRIPE_SUBSCRIPTION_ID"),
            SimpleNamespace(id="STRIPE_INVOICE_ID"),
        )

        checkout = await checkout_service.handle_free_success(
            session, checkout_recurring_free.id
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()
        stripe_service_mock.create_out_of_band_invoice.assert_not_called()

    async def test_valid_discount_percentage_100(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        checkout_discount_percentage_100: Checkout,
    ) -> None:
        checkout_discount_percentage_100.status = CheckoutStatus.confirmed
        checkout_discount_percentage_100.payment_processor_metadata = {
            "customer_id": "STRIPE_CUSTOMER_ID"
        }
        await save_fixture(checkout_discount_percentage_100)

        stripe_service_mock.create_out_of_band_subscription.return_value = (
            SimpleNamespace(id="STRIPE_SUBSCRIPTION_ID"),
            SimpleNamespace(id="STRIPE_INVOICE_ID"),
        )

        checkout = await checkout_service.handle_free_success(
            session, checkout_discount_percentage_100.id
        )

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_out_of_band_subscription.assert_called_once()
        stripe_service_mock.set_automatically_charged_subscription.assert_called_once()
        stripe_service_mock.create_out_of_band_invoice.assert_not_called()

    async def test_valid_custom_pricing_discount_percentage_100(
        self,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        product_one_time_custom_price: Product,
        discount_percentage_100: Discount,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_custom_price],
            amount=1000,
            status=CheckoutStatus.confirmed,
            discount=discount_percentage_100,
            payment_processor_metadata={"customer_id": "STRIPE_CUSTOMER_ID"},
        )

        stripe_service_mock.create_out_of_band_invoice.return_value = SimpleNamespace(
            id="STRIPE_INVOICE_ID"
        )

        checkout = await checkout_service.handle_free_success(session, checkout.id)

        assert checkout.status == CheckoutStatus.succeeded
        stripe_service_mock.create_price_for_product.assert_called_once()
        stripe_service_mock.create_out_of_band_invoice.assert_called_once()
        stripe_service_mock.create_out_of_band_subscription.assert_not_called()


@pytest.mark.asyncio
class TestExpireOpenCheckouts:
    async def test_valid(
        self, save_fixture: SaveFixture, session: AsyncSession, product: Product
    ) -> None:
        open_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.open,
            expires_at=utc_now() + timedelta(days=1),
        )
        expired_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.open,
            expires_at=utc_now() - timedelta(days=1),
        )
        successful_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.succeeded,
            expires_at=utc_now() - timedelta(days=1),
        )

        await checkout_service.expire_open_checkouts(session)

        updated_open_checkout = await checkout_service.get(session, open_checkout.id)
        assert updated_open_checkout is not None
        assert updated_open_checkout.status == CheckoutStatus.open

        updated_expired_checkout = await checkout_service.get(
            session, expired_checkout.id
        )
        assert updated_expired_checkout is not None
        assert updated_expired_checkout.status == CheckoutStatus.expired

        updated_successful_checkout = await checkout_service.get(
            session, successful_checkout.id
        )
        assert updated_successful_checkout is not None
        assert updated_successful_checkout.status == CheckoutStatus.succeeded
