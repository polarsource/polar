import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
import stripe as stripe_lib
from pydantic_core import Url
from pytest_mock import MockerFixture

from polar.auth.models import Anonymous, AuthMethod, AuthSubject
from polar.checkout.schemas import (
    CheckoutConfirmStripe,
    CheckoutCreate,
    CheckoutCreatePublic,
    CheckoutUpdate,
)
from polar.checkout.service import (
    CheckoutDoesNotExist,
    NoCustomerOnCheckout,
    NoCustomerOnPaymentIntent,
    NoPaymentMethodOnPaymentIntent,
    NotAFreePrice,
    NotConfirmedCheckout,
    NotOpenCheckout,
    PaymentIntentNotSucceeded,
)
from polar.checkout.service import checkout as checkout_service
from polar.checkout.tax import IncompleteTaxLocation, TaxIDFormat, calculate_tax
from polar.enums import PaymentProcessor
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.kit.address import Address
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
from tests.fixtures.random_objects import (
    create_checkout,
    create_product_price_fixed,
    create_user,
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
                CheckoutCreate.model_validate(
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
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                amount=amount,
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
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                amount=amount,
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
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                customer_billing_address=Address.model_validate({"country": "FR"}),
                customer_tax_id="FR61954506077",
            ),
            auth_subject,
        )

        assert checkout.customer_tax_id == ("FR61954506077", TaxIDFormat.eu_vat)
        assert checkout.customer_tax_id_number == "FR61954506077"

    @pytest.mark.auth
    async def test_valid_success_url(
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
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                success_url=Url(
                    "https://example.com/success?checkout_id={CHECKOUT_ID}"
                ),
            ),
            auth_subject,
        )

        assert (
            checkout.success_url
            == f"https://example.com/success?checkout_id={checkout.id}"
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
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
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
            CheckoutCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                customer_billing_address=Address.model_validate({"country": "FR"}),
            ),
            auth_subject,
        )

        assert checkout.tax_amount == 100
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "FR"


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestClientCreate:
    async def test_not_existing_price(
        self, session: AsyncSession, auth_subject: AuthSubject[Anonymous]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.client_create(
                session,
                CheckoutCreatePublic(
                    product_price_id=uuid.uuid4(),
                ),
                auth_subject,
            )

    async def test_archived_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Anonymous],
        product_one_time: Product,
    ) -> None:
        price = await create_product_price_fixed(
            save_fixture,
            product=product_one_time,
            type=ProductPriceType.one_time,
            is_archived=True,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.client_create(
                session,
                CheckoutCreatePublic(product_price_id=price.id),
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
                CheckoutCreatePublic(
                    product_price_id=product_one_time.prices[0].id,
                ),
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
            session,
            CheckoutCreatePublic(product_price_id=price.id),
            auth_subject,
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
            CheckoutCreatePublic(product_price_id=price.id),
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
            CheckoutCreatePublic(product_price_id=price.id),
            auth_subject,
        )

        assert checkout.product_price == price
        assert checkout.product == product_one_time_custom_price
        assert checkout.amount == price.preset_amount
        assert checkout.currency == price.price_currency

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", method=AuthMethod.COOKIE),
        AuthSubjectFixture(subject="user", method=AuthMethod.OAUTH2_ACCESS_TOKEN),
    )
    async def test_valid_direct_user(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.client_create(
            session,
            CheckoutCreatePublic(product_price_id=price.id),
            auth_subject,
        )
        assert checkout.customer == auth_subject.subject

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user", method=AuthMethod.PERSONAL_ACCESS_TOKEN),
    )
    async def test_valid_indirect_user(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_one_time: Product,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout = await checkout_service.client_create(
            session,
            CheckoutCreatePublic(product_price_id=price.id),
            auth_subject,
        )

        assert checkout.customer is None


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
        user_organization: UserOrganization,
        product: Product,
        checkout_recurring_fixed: Checkout,
    ) -> None:
        for key, value in initial_values.items():
            setattr(checkout_recurring_fixed, key, value)
        await save_fixture(checkout_recurring_fixed)

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.update(
                session,
                checkout_recurring_fixed,
                CheckoutUpdate.model_validate(updated_values),
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

    async def test_valid_fixed_price_amount_update(
        self,
        session: AsyncSession,
        user_organization: UserOrganization,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
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

    async def test_valid_free_price_amount_update(
        self,
        session: AsyncSession,
        user_organization: UserOrganization,
        checkout_one_time_free: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
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
        user_organization: UserOrganization,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout = await checkout_service.update(
            session,
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
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        checkout_one_time_custom: Checkout,
    ) -> None:
        checkout_one_time_custom.customer_tax_id = ("FR61954506077", TaxIDFormat.eu_vat)
        await save_fixture(checkout_one_time_custom)

        checkout = await checkout_service.update(
            session,
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
        calculate_tax_mock: AsyncMock,
        user_organization: UserOrganization,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        calculate_tax_mock.side_effect = IncompleteTaxLocation(
            stripe_lib.InvalidRequestError("ERROR", "ERROR")
        )

        checkout = await checkout_service.update(
            session,
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
        calculate_tax_mock: AsyncMock,
        user_organization: UserOrganization,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        calculate_tax_mock.return_value = 100

        checkout = await checkout_service.update(
            session,
            checkout_one_time_fixed,
            CheckoutUpdate(
                customer_billing_address=Address.model_validate({"country": "FR"}),
            ),
        )

        assert checkout.tax_amount == 100
        assert checkout.customer_billing_address is not None
        assert checkout.customer_billing_address.country == "FR"


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
        checkout_one_time_fixed: Checkout,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
                checkout_one_time_fixed,
                CheckoutConfirmStripe.model_validate(payload),
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

    async def test_calculate_tax_error(
        self,
        calculate_tax_mock: AsyncMock,
        session: AsyncSession,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        calculate_tax_mock.side_effect = IncompleteTaxLocation(
            stripe_lib.InvalidRequestError("ERROR", "ERROR")
        )

        with pytest.raises(PolarRequestValidationError):
            await checkout_service.confirm(
                session,
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
        customer_billing_address: dict[str, str],
        expected_tax_metadata: dict[str, str],
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        checkout_one_time_fixed: Checkout,
    ) -> None:
        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )
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
                    "customer_billing_address": customer_billing_address,
                }
            ),
        )

        assert checkout.status == CheckoutStatus.confirmed
        assert checkout.payment_processor_metadata == {
            "payment_intent_client_secret": "CLIENT_SECRET",
            "payment_intent_status": "succeeded",
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

    async def test_valid_stripe_free(
        self,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
        session: AsyncSession,
        checkout_one_time_free: Checkout,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.checkout.service.enqueue_job")

        stripe_service_mock.create_customer.return_value = SimpleNamespace(
            id="STRIPE_CUSTOMER_ID"
        )

        checkout = await checkout_service.confirm(
            session,
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
        checkout_one_time_fixed: Checkout,
    ) -> None:
        user = await create_user(save_fixture, stripe_customer_id="STRIPE_CUSTOMER_ID")
        checkout_one_time_fixed.customer = user
        await save_fixture(checkout_one_time_fixed)

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

        assert checkout.status == CheckoutStatus.confirmed
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


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
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


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
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

    async def test_not_a_free_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        checkout_confirmed_one_time: Checkout,
    ) -> None:
        checkout_confirmed_one_time.payment_processor_metadata = {
            "customer_id": "STRIPE_CUSTOMER_ID"
        }
        await save_fixture(checkout_confirmed_one_time)

        with pytest.raises(NotAFreePrice):
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
