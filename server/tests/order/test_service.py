import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from unittest.mock import ANY, AsyncMock, MagicMock, call

import pytest
import pytest_asyncio
import stripe as stripe_lib
from freezegun import freeze_time
from pydantic import BaseModel
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent
from polar.config import settings
from polar.email.schemas import OrderConfirmationEmail
from polar.enums import (
    InvoiceNumbering,
    PaymentMode,
    PaymentProcessor,
    SubscriptionRecurringInterval,
    TaxBehavior,
    TaxBehaviorOption,
    TaxProcessor,
)
from polar.event.system import SystemEvent
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.invoice.service import invoice as invoice_service
from polar.kit.address import (
    Address,
    AddressDict,
    AddressInput,
    CountryAlpha2,
    CountryAlpha2Input,
)
from polar.kit.currency import (
    get_maximum_currency_amount,
    get_minimum_currency_amount,
)
from polar.kit.db.postgres import AsyncSession
from polar.kit.math import polar_round
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.kit.visibility import Visibility
from polar.models import (
    Account,
    BillingEntry,
    Customer,
    Discount,
    Order,
    PaymentMethod,
    Product,
    ProductPriceFixed,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.checkout import CheckoutStatus
from polar.models.custom_field import CustomFieldType
from polar.models.customer import CustomerType
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.organization import Organization, OrganizationStatus
from polar.models.payment import PaymentStatus, PaymentTrigger
from polar.models.product import ProductBillingType
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import PlatformFeeType, TransactionType
from polar.models.wallet import WalletType
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.schemas import OrderCreate, OrderUpdate
from polar.order.service import (
    ManualRetryLimitExceeded,
    MissingCheckoutCustomer,
    MissingInvoiceBillingDetails,
    NoPendingBillingEntries,
    NotRecurringProduct,
    OffSessionChargesNotEnabled,
    OrderNotDraft,
    OrderNotEligibleForInvoice,
    OrderNotEligibleForRetry,
    OrderNotPending,
    OrganizationNotReadyForPayments,
    PaymentActionRequired,
    PaymentAlreadyInProgress,
    PaymentFailed,
    RecurringProduct,
    SubscriptionNotTrialing,
)
from polar.order.service import order as order_service
from polar.product.guard import is_fixed_price, is_seat_price, is_static_price
from polar.product.price_set import PriceSet
from polar.subscription.service import SubscriptionService
from polar.tax.calculation import (
    CalculationExpiredError,
    TaxabilityReason,
    TaxCalculation,
    TaxCalculationLogicalError,
    TaxCalculationService,
    get_tax_behavior_from_option,
)
from polar.tax.tax_id import TaxID
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.platform_fee import PlatformFeeTransactionService
from polar.wallet.service import wallet as wallet_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.events import get_all_by_name
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_benefit,
    create_billing_entry,
    create_canceled_subscription,
    create_checkout,
    create_custom_field,
    create_customer,
    create_discount,
    create_event,
    create_order,
    create_payment,
    create_payment_method,
    create_product,
    create_product_fixed_and_seat,
    create_subscription,
    create_trialing_subscription,
    create_wallet,
    create_wallet_billing,
    create_wallet_transaction,
    set_product_benefits,
)
from tests.transaction.conftest import create_transaction


def build_stripe_payment_intent(
    *,
    amount: int = 0,
    status: str = "succeeded",
    customer: str | None = "CUSTOMER_ID",
    payment_method: str | None = "PAYMENT_METHOD_ID",
    latest_charge: str | None = "CHARGE_ID",
) -> stripe_lib.PaymentIntent:
    return stripe_lib.PaymentIntent.construct_from(
        {
            "id": "STRIPE_PAYMENT_INTENT_ID",
            "amount": amount,
            "status": status,
            "customer": customer,
            "payment_method": payment_method,
            "latest_charge": latest_charge,
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture, customer: Customer) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.order.service.stripe_service", new=mock)

    mock.get_customer.return_value = SimpleNamespace(
        id=customer.stripe_customer_id,
        email=customer.email,
        name=customer.name,
        address=customer.billing_address,
    )

    return mock


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.order.service.enqueue_job")


@pytest.fixture
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.order.service.enqueue_email_template", autospec=True)


@pytest.fixture
def publish_checkout_event_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.order.service.publish_checkout_event")


@pytest.fixture
def event_creation_time() -> tuple[datetime, int]:
    created_datetime = datetime.fromisoformat("2024-01-01T00:00:00Z")
    created_unix_timestamp = int(created_datetime.timestamp())
    return created_datetime, created_unix_timestamp


@pytest.fixture(autouse=True)
def tax_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = mocker.patch(
        "polar.order.service.tax_calculation_service", spec=TaxCalculationService
    )
    mocker.patch("polar.order.amounts.tax_calculation_service", new=mock)
    mock.record.return_value = ("TAX_TRANSACTION_ID", TaxProcessor.numeral)
    return mock


@pytest.fixture
def calculate_tax_mock(tax_service_mock: MagicMock) -> AsyncMock:
    async def mocked_calculate_tax(
        identifier: uuid.UUID,
        currency: str,
        amount: int,
        tax_behavior: TaxBehaviorOption,
        stripe_product_id: str,
        address: Address,
        tax_ids: list[TaxID],
        tax_exempted: bool,
    ) -> tuple[TaxCalculation, TaxProcessor]:
        tax_amount = polar_round(amount * 0.20)
        return (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": tax_amount,
                "currency": currency,
                "tax_behavior": get_tax_behavior_from_option(tax_behavior, address),
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.2,
                        "display_name": "Tax",
                        "country": address.country,
                        "state": None,
                        "subdivision": None,
                        "amount": tax_amount,
                        "taxability_reason": TaxabilityReason.standard_rated,
                    }
                ],
            },
            TaxProcessor.numeral,
        )

    tax_service_mock.calculate.side_effect = mocked_calculate_tax

    return tax_service_mock.calculate


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        customer: Customer,
        customer_organization_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
        )

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order.id

    @pytest.mark.auth
    async def test_user_organization_filter(
        self,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        organization_second: Organization,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        customer: Customer,
        customer_organization_second: Customer,
    ) -> None:
        user_organization_second_admin = UserOrganization(
            user_id=user.id, organization_id=organization_second.id
        )
        await save_fixture(user_organization_second_admin)

        order_organization = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        order_organization_second = await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
        )

        # No filter
        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )
        assert count == 2
        assert len(orders) == 2
        assert orders[0].id == order_organization_second.id
        assert orders[1].id == order_organization.id

        # Filter by organization
        orders, count = await order_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            organization_id=[organization_second.id],
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order_organization_second.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        product_organization_second: Product,
        customer: Customer,
        customer_organization_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        await create_order(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
        )

        orders, count = await order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order.id

    @pytest.mark.auth
    async def test_product_billing_type_filter(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_organization: UserOrganization,
        product: Product,
        product_one_time_custom_price: Product,
        product_one_time_free_price: Product,
        customer: Customer,
    ) -> None:
        order1 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )
        order2 = await create_order(
            save_fixture,
            product=product_one_time_custom_price,
            customer=customer,
        )

        orders, count = await order_service.list(
            session,
            auth_subject,
            product_billing_type=(ProductBillingType.recurring,),
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order1.id

        orders, count = await order_service.list(
            session,
            auth_subject,
            product_billing_type=(ProductBillingType.one_time,),
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].id == order2.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        order1 = await create_order(
            save_fixture,
            user_metadata={"reference_id": "ABC"},
            product=product,
            customer=customer,
        )
        order2 = await create_order(
            save_fixture,
            user_metadata={"reference_id": "DEF"},
            product=product,
            customer=customer,
        )
        await create_order(
            save_fixture,
            user_metadata={"reference_id": "GHI"},
            product=product,
            customer=customer,
        )

        orders, total = await order_service.list(
            session,
            auth_subject,
            metadata={"reference_id": ["ABC", "DEF"]},
            pagination=PaginationParams(1, 10),
        )

        assert len(orders) == 2
        assert total == 2

        assert order1 in orders
        assert order2 in orders


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.parametrize(
        ("set_address", "address_update"),
        [
            ({"country": "US", "state": "CA"}, {"country": "US", "state": "NY"}),
            ({"country": "US", "state": "CA"}, {"country": "FR", "state": None}),
            ({"country": "FR", "state": None}, {"country": "US", "state": "CA"}),
        ],
    )
    async def test_invalid_country_state_update(
        self,
        set_address: AddressDict,
        address_update: AddressDict,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            billing_address=Address.model_validate(set_address),
        )

        with pytest.raises(PolarRequestValidationError):
            await order_service.update(
                session,
                order,
                OrderUpdate(
                    billing_name=None,
                    billing_address=AddressInput.model_validate(address_update),
                ),
            )

    async def test_valid_billing_address_update(
        self, save_fixture: SaveFixture, session: AsyncSession, customer: Customer
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        updated_order = await order_service.update(
            session,
            order,
            OrderUpdate(
                billing_name="New Name",
                billing_address=AddressInput(
                    line1="Rue de la Paix",
                    city="Paris",
                    postal_code="75000",
                    country=CountryAlpha2Input("FR"),
                ),
            ),
        )
        await session.flush()
        await session.refresh(updated_order)

        assert updated_order.billing_name == "New Name"
        assert updated_order.billing_address is not None
        assert updated_order.billing_address.country == "FR"
        assert updated_order.billing_address.line1 == "Rue de la Paix"


@pytest.mark.asyncio
class TestCreateFromCheckoutOneTime:
    async def test_recurring_product(
        self, save_fixture: SaveFixture, session: AsyncSession, product: Product
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], status=CheckoutStatus.confirmed
        )
        with pytest.raises(RecurringProduct):
            await order_service.create_from_checkout_one_time(session, checkout)

    async def test_missing_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product_one_time], status=CheckoutStatus.confirmed
        )
        with pytest.raises(MissingCheckoutCustomer):
            await order_service.create_from_checkout_one_time(session, checkout)

    async def test_fixed(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReasonInternal.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time
        assert len(order.items) == len(product_one_time.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_custom(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_custom_price: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_custom_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
            amount=4242,
            currency="usd",
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReasonInternal.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_custom_price
        assert len(order.items) == len(product_one_time_custom_price.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_custom_price.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_free(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_free_price: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_free_price],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == 0
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReasonInternal.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_free_price
        assert len(order.items) == len(product_one_time_free_price.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_free_price.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_fixed_discounted_100(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        discount_percentage_100: Discount,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
            discount=discount_percentage_100,
        )

        discount_amount = sum(
            cast(ProductPriceFixed, price).price_amount
            for price in product_one_time.prices
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == 0
        assert order.discount_amount == discount_amount
        assert order.billing_reason == OrderBillingReasonInternal.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time
        assert len(order.items) == len(product_one_time.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_multi_currencies(
        self,
        publish_checkout_event_mock: AsyncMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time_multiple_currencies: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time_multiple_currencies],
            status=CheckoutStatus.confirmed,
            customer=customer,
            currency="eur",
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReasonInternal.purchase
        assert order.customer == checkout.customer
        assert order.product == product_one_time_multiple_currencies
        assert order.currency == "eur"

        currency_prices = PriceSet.from_product(
            product_one_time_multiple_currencies, "eur"
        )
        assert len(order.items) == len(currency_prices.prices)

        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer.id,
            product_id=product_one_time_multiple_currencies.id,
            order_id=order.id,
        )
        publish_checkout_event_mock.assert_awaited_once_with(
            checkout.client_secret, CheckoutEvent.order_created
        )

    async def test_seat_based_upgrades_customer_to_team(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[("seat", 1000, "usd")],
        )

        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
            seats=5,
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.seats == 5
        assert order.customer == checkout.customer

        await session.refresh(customer)
        assert customer.type == CustomerType.team

        # Seat-based orders defer benefit grants until seats are claimed
        for c in enqueue_job_mock.call_args_list:
            assert c.args[0] != "benefit.enqueue_benefits_grants"

    async def test_fixed_does_not_upgrade_customer_to_team(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        await order_service.create_from_checkout_one_time(session, checkout)

        await session.refresh(customer)
        assert customer.type == CustomerType.individual

    async def test_composed_fixed_and_seat_upgrades_customer_to_team(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        # A one-time product composing a fixed price with a seat price always
        # bills both (fixed + per-seat), so the buyer really does purchase seats
        # and must be upgraded to 'team'.
        product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            fixed_amount=5000,
            price_per_seat=1000,
        )

        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
            seats=3,
        )

        order = await order_service.create_from_checkout_one_time(session, checkout)

        assert order.seats == 3
        assert len(order.items) == 2

        await session.refresh(customer)
        assert customer.type == CustomerType.team

        # Seat-based orders defer benefit grants until seats are claimed
        for c in enqueue_job_mock.call_args_list:
            assert c.args[0] != "benefit.enqueue_benefits_grants"


@pytest.mark.asyncio
class TestCreateFromCheckoutSubscription:
    async def test_not_recurring_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_one_time: Product,
        subscription: Subscription,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product_one_time], status=CheckoutStatus.confirmed
        )
        with pytest.raises(NotRecurringProduct):
            await order_service.create_from_checkout_subscription(
                session,
                checkout,
                subscription,
                OrderBillingReasonInternal.subscription_create,
            )

    async def test_missing_customer(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture, products=[product], status=CheckoutStatus.confirmed
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        with pytest.raises(MissingCheckoutCustomer):
            await order_service.create_from_checkout_subscription(
                session,
                checkout,
                subscription,
                OrderBillingReasonInternal.subscription_create,
            )

    async def test_fixed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        order = await order_service.create_from_checkout_subscription(
            session,
            checkout,
            subscription,
            OrderBillingReasonInternal.subscription_create,
        )

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReasonInternal.subscription_create
        assert order.customer == checkout.customer
        assert order.product == product
        assert len(order.items) == len(product.prices)

    async def test_metered(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product_recurring_metered],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )
        subscription = await create_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )

        order = await order_service.create_from_checkout_subscription(
            session,
            checkout,
            subscription,
            OrderBillingReasonInternal.subscription_create,
        )

        assert order.net_amount == checkout.net_amount
        assert order.discount_amount == 0
        assert order.billing_reason == OrderBillingReasonInternal.subscription_create
        assert order.customer == checkout.customer
        assert order.product == product_recurring_metered
        assert len(order.items) == len(
            [p for p in product_recurring_metered.prices if is_static_price(p)]
        )

    async def test_fixed_and_seat(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product_fixed_and_seat(
            save_fixture,
            organization=organization,
            fixed_amount=99900,
            price_per_seat=2000,
        )
        fixed_price = next(p for p in product.prices if is_fixed_price(p))
        seat_price = next(p for p in product.prices if is_seat_price(p))

        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
            seats=10,
        )
        assert checkout.amount == (
            fixed_price.price_amount + seat_price.calculate_amount(10)
        )

        subscription = await create_subscription(
            save_fixture, product=product, customer=customer, seats=10
        )

        order = await order_service.create_from_checkout_subscription(
            session,
            checkout,
            subscription,
            OrderBillingReasonInternal.subscription_create,
        )

        assert order.customer == checkout.customer
        assert order.product == product

        # Two static line items (fixed + seat), summing to the combined subtotal.
        assert len(order.items) == 2
        by_price = {item.product_price_id: item for item in order.items}
        assert by_price[fixed_price.id].amount == fixed_price.price_amount
        assert by_price[seat_price.id].amount == seat_price.calculate_amount(10)
        assert sum(item.amount for item in order.items) == order.subtotal_amount
        assert order.subtotal_amount == checkout.amount


class DiscountFixture(BaseModel):
    type: DiscountType
    duration: DiscountDuration
    basis_points: int | None = None
    duration_in_months: int | None = None
    applies_to: list[str] | None = None
    amounts: dict[str, int] | None = None


class ProrationFixture(BaseModel):
    discount: DiscountFixture | None = None
    products: dict[str, tuple[SubscriptionRecurringInterval, int]]
    history: list[
        tuple[
            str,
            BillingEntryType,
            tuple[BillingEntryDirection, int, int],
            datetime,
            datetime,
        ]
    ]
    expected_discount: int
    expected_subtotal: int
    expected_tax: int


@pytest.mark.asyncio
class TestCreateSubscriptionOrder:
    async def test_no_pending_billing_items(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        with pytest.raises(NoPendingBillingEntries):
            await order_service.create_subscription_order(
                session, subscription, OrderBillingReasonInternal.subscription_cycle
            )

    @pytest.mark.parametrize(
        ("tax_behavior", "amount", "tax_amount", "expected_net_amount"),
        [
            (TaxBehavior.exclusive, 1000, 200, 1000),
            (TaxBehavior.inclusive, 1000, 200, 800),
        ],
    )
    async def test_cycle_fixed_price(
        self,
        tax_behavior: TaxBehavior,
        amount: int,
        tax_amount: int,
        expected_net_amount: int,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
        payment_method: PaymentMethod,
    ) -> None:
        calculate_tax_mock.return_value = (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": tax_amount,
                "currency": product.prices[0].price_currency,
                "tax_behavior": tax_behavior,
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.2,
                        "display_name": "Tax",
                        "country": "FR",
                        "state": None,
                        "subdivision": None,
                        "amount": tax_amount,
                        "taxability_reason": TaxabilityReason.standard_rated,
                    }
                ],
            },
            TaxProcessor.numeral,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
            tax_behavior=tax_behavior,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        billing_entry = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert len(order.items) == 1
        order_item = order.items[0]
        assert order_item.product_price == price
        assert order_item.amount == billing_entry.amount
        assert order_item.order == order

        assert order.subtotal_amount == billing_entry.amount
        assert order.net_amount == expected_net_amount
        assert order.tax_amount == tax_amount
        assert order.total_amount == expected_net_amount + tax_amount
        assert order.status == OrderStatus.pending
        assert order.billing_reason == OrderBillingReasonInternal.subscription_cycle
        assert order.subscription == subscription

        if tax_behavior == TaxBehavior.inclusive:
            assert subscription.net_amount == round(
                subscription.amount
                * order.net_amount
                / (order.net_amount + order.tax_amount)
            )
        else:
            assert subscription.net_amount == subscription.amount

        calculate_tax_mock.assert_called_once_with(
            str(order.id),
            subscription.currency,
            order.subtotal_amount - order.discount_amount,
            tax_behavior.to_option(),
            product.tax_code,
            customer.billing_address,
            [],
            False,
        )

        assert billing_entry.amount is not None
        assert order.tax_calculation_processor_id == "TAX_PROCESSOR_ID"
        assert order.tax_breakdown is not None
        assert (
            order.tax_breakdown[0]["taxability_reason"]
            == TaxabilityReason.standard_rated
        )
        assert order.tax_transaction_processor_id is None
        assert order.tax_behavior == tax_behavior

        await session.refresh(billing_entry)
        assert billing_entry.order_item is not None
        assert billing_entry.order_item.order_id == order.id

        enqueue_job_mock.assert_any_call(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=subscription.payment_method_id,
            payment_trigger="subscription_cycle",
        )

    async def test_cycle_discount(
        self,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
        payment_method: PaymentMethod,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=5000,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
            discount=discount,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        billing_entry = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.discount == discount
        assert order.discount_amount == price.price_amount / 2
        assert order.net_amount == order.subtotal_amount - order.discount_amount

        calculate_tax_mock.assert_called_once_with(
            str(order.id),
            subscription.currency,
            order.net_amount,
            TaxBehaviorOption.exclusive,
            product.tax_code,
            customer.billing_address,
            [],
            False,
        )

        await session.refresh(billing_entry)
        assert billing_entry.order_item is not None
        assert billing_entry.order_item.order_id == order.id

    async def test_cycle_free_order(
        self,
        enqueue_job_mock: MagicMock,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10000,
            duration=DiscountDuration.forever,
            organization=organization,
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer, discount=discount
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        billing_entry = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.net_amount == 0
        assert order.status == OrderStatus.paid

        enqueued_jobs = [call[0][0] for call in enqueue_job_mock.call_args_list]
        assert "order.trigger_payment" not in enqueued_jobs

        calculate_tax_mock.assert_not_called()

        await session.refresh(billing_entry)
        assert billing_entry.order_item is not None
        assert billing_entry.order_item.order_id == order.id

    async def test_cycle_tax_exempted(
        self,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
        payment_method: PaymentMethod,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
            tax_exempted=True,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        calculate_tax_mock.assert_called_once_with(
            str(order.id),
            subscription.currency,
            order.subtotal_amount,
            TaxBehaviorOption.exclusive,
            product.tax_code,
            customer.billing_address,
            [],
            True,
        )

    async def test_cycle_no_payment_method(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        enqueued_jobs = [call[0][0] for call in enqueue_job_mock.call_args_list]
        assert "order.trigger_payment" not in enqueued_jobs

        assert order.next_payment_attempt_at is not None
        assert subscription.status == SubscriptionStatus.past_due

    async def test_cycle_proration(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        payment_method: PaymentMethod,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        old_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(500, "usd")],
        )
        old_price = cast(ProductPriceFixed, old_product.prices[0])
        new_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(3000, "usd")],
        )
        new_price = cast(ProductPriceFixed, new_product.prices[0])

        billing_entry_credit = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.credit,
            start_timestamp=datetime(2025, 6, 1, tzinfo=UTC),
            end_timestamp=datetime(2025, 6, 16, tzinfo=UTC),
            customer=subscription.customer,
            product_price=old_price,
            amount=round(old_price.price_amount * 0.5),  # 250
            currency=old_price.price_currency,
            subscription=subscription,
        )
        billing_entry_debit = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.debit,
            start_timestamp=datetime(2025, 6, 16, tzinfo=UTC),
            end_timestamp=datetime(2025, 7, 1, tzinfo=UTC),
            customer=subscription.customer,
            product_price=new_price,
            amount=round(new_price.price_amount * 0.5),  # 1500
            currency=new_price.price_currency,
            subscription=subscription,
        )
        billing_entry_cycle = await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            direction=BillingEntryDirection.debit,
            start_timestamp=datetime(2025, 7, 1, tzinfo=UTC),
            end_timestamp=datetime(2025, 8, 1, tzinfo=UTC),
            customer=subscription.customer,
            product_price=new_price,
            amount=new_price.price_amount,  # 3000
            currency=new_price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert len(order.items) == 3
        order_items = sorted(order.items, key=lambda i: i.amount)
        assert order_items[0].product_price == old_price
        assert order_items[0].amount == -250
        assert order_items[1].product_price == new_price
        assert order_items[1].amount == 1500
        assert order_items[2].product_price == new_price
        assert order_items[2].amount == 3000

        assert order.status == OrderStatus.pending
        assert order.billing_reason == OrderBillingReasonInternal.subscription_cycle
        assert order.subscription == subscription

        assert order.subtotal_amount == 4250
        assert order.tax_amount == 850
        assert order.tax_calculation_processor_id == "TAX_PROCESSOR_ID"
        assert order.tax_breakdown is not None
        assert (
            order.tax_breakdown[0]["taxability_reason"]
            == TaxabilityReason.standard_rated
        )
        assert order.tax_transaction_processor_id is None

        for entry in [billing_entry_credit, billing_entry_debit, billing_entry_cycle]:
            await session.refresh(entry)
            assert entry is not None
            assert entry.order_item is not None
            assert entry.order_item.order_id == order.id

        enqueue_job_mock.assert_any_call(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=subscription.payment_method_id,
            payment_trigger="subscription_cycle",
        )

    @pytest.mark.parametrize(
        "setup",
        [
            pytest.param(
                # 25% off every month for 3 months
                # Switch from Basic to Pro middle of month
                ProrationFixture(
                    discount=DiscountFixture(
                        # 25% off on Basic
                        type=DiscountType.percentage,
                        basis_points=2500,
                        duration=DiscountDuration.repeating,
                        duration_in_months=3,
                        applies_to=["p-basic"],
                    ),
                    products={
                        "p-basic": (SubscriptionRecurringInterval.month, 3000),
                        "p-pro": (SubscriptionRecurringInterval.month, 9000),
                    },
                    history=[
                        (
                            "p-basic",
                            # 3000 x 50% (half a month), discount: (100 - 25)% x 1500 = 375
                            # (BillingEntryDirection.credit, 1125),
                            # BillingEntries don't include discounts
                            BillingEntryType.proration,
                            # INCLUDES discount
                            (BillingEntryDirection.credit, 1125, 375),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2026, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.proration,
                            # 9000 x 50% (half a month) discount: (100 - 25)% x 4500 = 1125
                            # INCLUDES discount
                            (BillingEntryDirection.debit, 3375, 1125),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2025, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.cycle,
                            # EXCLUDES discount
                            (BillingEntryDirection.debit, 9000, 1800),
                            datetime(2025, 10, 1, tzinfo=UTC),
                            datetime(2025, 11, 1, tzinfo=UTC),
                        ),
                    ],
                    expected_discount=0 + 2250,
                    # (4500 - 1125) - (1500 - 375) = 2250
                    expected_subtotal=2250 + 9000,
                    # Tax: 2250 x 20% = 450 ; (9000 - 2250) x 25% = 1440
                    expected_tax=450 + 1350,
                ),
                id="discount-applies-only-to-first-product",
            ),
            pytest.param(
                # $10 off every month for 3 months
                # Switch from Basic to Pro middle of month
                ProrationFixture(
                    discount=DiscountFixture(
                        type=DiscountType.fixed,
                        amounts={"usd": 1000},
                        duration=DiscountDuration.repeating,
                        duration_in_months=3,
                        applies_to=["p-basic"],
                    ),
                    products={
                        "p-basic": (SubscriptionRecurringInterval.month, 3000),
                        "p-pro": (SubscriptionRecurringInterval.month, 9000),
                    },
                    history=[
                        # Discounts aren't applied on the BillingEntry, but they are applied to the OrderItem
                        (
                            "p-basic",
                            BillingEntryType.proration,
                            # 3000 x 50% (half a month)
                            # INCLUDES discount
                            (BillingEntryDirection.credit, 500, 1000),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2026, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.proration,
                            # 9000 x 50% (half a month)
                            # INCLUDES discount
                            (BillingEntryDirection.debit, 2750, 1750),
                            datetime(2025, 9, 16, tzinfo=UTC),
                            datetime(2025, 10, 1, tzinfo=UTC),
                        ),
                        (
                            "p-pro",
                            BillingEntryType.cycle,
                            # EXCLUDES discount
                            (BillingEntryDirection.debit, 9000, 1000),
                            datetime(2025, 10, 1, tzinfo=UTC),
                            datetime(2025, 11, 1, tzinfo=UTC),
                        ),
                    ],
                    expected_discount=1000,
                    # (4500 - 1750) - (1500 - 1000) = 2250
                    expected_subtotal=2250 + 9000,
                    expected_tax=450 + 1600,  # 2250 x 20% = 450 ; 8000 x 20% = 1600
                    # You paid 2000 for the month. Now you get 1000 back (50% the month).
                ),
                id="fixed-discount-on-first-product",
            ),
            pytest.param(
                # Switch from yearly to monthly after 3 months and 1 day
                ProrationFixture(
                    discount=DiscountFixture(
                        type=DiscountType.percentage,
                        basis_points=5000,
                        duration=DiscountDuration.forever,
                    ),
                    products={
                        "p-monthly": (SubscriptionRecurringInterval.month, 3000),
                        "p-yearly": (SubscriptionRecurringInterval.year, 30000),
                    },
                    history=[
                        (
                            "p-yearly",
                            BillingEntryType.proration,
                            # INCLUDES discount
                            # 30000 * 50% * (365 - 30 - 31 - 31) / 365 = 11219
                            (BillingEntryDirection.credit, 11219, 11219),
                            datetime(2025, 6, 1, tzinfo=UTC),
                            datetime(2025, 9, 1, tzinfo=UTC),
                        ),
                        (
                            "p-monthly",
                            BillingEntryType.cycle,
                            # EXCLUDES discount
                            (BillingEntryDirection.debit, 3000, 1500),
                            datetime(2025, 9, 1, tzinfo=UTC),
                            datetime(2025, 10, 1, tzinfo=UTC),
                        ),
                    ],
                    expected_discount=1500,
                    expected_subtotal=-11219 + 3000,
                    expected_tax=-1944,  # (-11219 + 3000 - 1500) * 20%
                ),
                id="yearly-to-monthly",
            ),
        ],
    )
    async def test_cycle_proration_discount(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        setup: ProrationFixture,
        payment_method: PaymentMethod,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )

        products = {}
        prices = {}
        for key, (recurring_interval, price_amount) in setup.products.items():
            product = await create_product(
                save_fixture,
                organization=organization,
                recurring_interval=recurring_interval,
                prices=[(price_amount, "usd")],
            )
            products[key] = product

            price = cast(ProductPriceFixed, product.prices[0])
            prices[key] = price

        entries = []
        for product_key, type, (
            dir,
            amount,
            discount_amount,
        ), start_dt, end_dt in setup.history:
            price = prices[product_key]
            entry = await create_billing_entry(
                save_fixture,
                type=type,
                direction=dir,
                start_timestamp=start_dt,
                end_timestamp=end_dt,
                customer=subscription.customer,
                product_price=price,
                amount=amount,
                discount_amount=discount_amount,
                currency=price.price_currency,
                subscription=subscription,
            )
            entries.append(entry)

        if setup.discount:
            discount = await create_discount(
                save_fixture,
                type=setup.discount.type,
                amounts=setup.discount.amounts,
                basis_points=setup.discount.basis_points,
                duration=setup.discount.duration,
                duration_in_months=setup.discount.duration_in_months,
                organization=organization,
                products=[products[key] for key in setup.discount.applies_to]  # type: ignore
                if setup.discount.applies_to
                else None,
            )
            subscription.discount = discount
            session.add(subscription)
            await session.flush()

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert len(order.items) == len(setup.history)
        assert order.discount == subscription.discount
        assert order.discount_amount == setup.expected_discount
        assert order.subtotal_amount == setup.expected_subtotal
        assert order.tax_amount == setup.expected_tax

        if order.subtotal_amount < 0:
            assert order.status == OrderStatus.paid
            assert order.tax_calculation_processor_id is None
            assert order.tax_transaction_processor_id is None
            assert order.tax_breakdown is not None
            assert all(item["amount"] <= 0 for item in order.tax_breakdown)
            assert (
                sum(item["amount"] for item in order.tax_breakdown) == order.tax_amount
            )
        else:
            assert order.status == OrderStatus.pending
            assert order.tax_calculation_processor_id == "TAX_PROCESSOR_ID"
            assert order.tax_breakdown is not None
            assert (
                order.tax_breakdown[0]["taxability_reason"]
                == TaxabilityReason.standard_rated
            )
            assert order.tax_transaction_processor_id is None

        assert order.billing_reason == OrderBillingReasonInternal.subscription_cycle
        assert order.subscription == subscription

        for entry in entries:
            await session.refresh(entry)
            assert entry is not None
            assert entry.order_item is not None
            assert entry.order_item.order_id == order.id

        customer_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, subscription.currency
        )
        if order.subtotal_amount >= 0:
            enqueue_job_mock.assert_any_call(
                "order.trigger_payment",
                order_id=order.id,
                payment_method_id=subscription.payment_method_id,
                payment_trigger="subscription_cycle",
            )
            assert customer_balance == 0
        else:
            assert (
                -customer_balance
                == setup.expected_subtotal
                - setup.expected_discount
                + setup.expected_tax
            )

        calculate_tax_mock.assert_called_once_with(
            str(order.id),
            subscription.currency,
            abs(order.net_amount),
            TaxBehaviorOption.exclusive,
            subscription.product.tax_code,
            customer.billing_address,
            [],
            False,
        )

    async def test_metered_subscription_cycle_resets_meters(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Test that subscription_cycle orders reset meters.

        This is the expected behavior for new billing cycles - meters should be
        reset to start fresh for the new period.
        """
        subscription_service_mock = mocker.patch(
            "polar.order.service.subscription_service", spec=SubscriptionService
        )

        subscription = await create_active_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )

        event = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
        )
        await save_fixture(
            BillingEntry.from_metered_event(
                customer, subscription.subscription_product_prices[0], event
            )
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert len(order.items) == 1
        assert order.subtotal_amount == 100

        subscription_service_mock.reset_meters.assert_awaited_once_with(
            session, subscription
        )

    async def test_subscription_update_does_not_reset_meters(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product_recurring_metered: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """
        Regression test for meter credit loss during subscription updates.

        When a subscription_update order is created, meters should NOT be reset.
        This ensures that meter credits from benefit grants remain valid for
        the current billing cycle.

        Bug context: Customers were being charged for metered usage even when
        they had sufficient credited units, because subscription_update orders
        were resetting meters mid-cycle without re-applying benefit credits.
        """
        subscription_service_mock = mocker.patch(
            "polar.order.service.subscription_service", spec=SubscriptionService
        )

        subscription = await create_active_subscription(
            save_fixture, product=product_recurring_metered, customer=customer
        )

        event = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
        )
        await save_fixture(
            BillingEntry.from_metered_event(
                customer, subscription.subscription_product_prices[0], event
            )
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_update
        )

        assert len(order.items) == 1
        assert order.subtotal_amount == 100

        # subscription_update should NOT reset meters
        # This ensures meter credits from benefit grants remain valid
        subscription_service_mock.reset_meters.assert_not_awaited()

    async def test_positive_order_positive_customer_balance(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        # Establish customer balance
        await create_wallet_billing(
            save_fixture,
            customer=customer,
            initial_balance=100_00,
        )

        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        price = product.prices[0]
        assert is_fixed_price(price)

        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=50_00,
            currency=price.price_currency,
            subscription=subscription,
        )

        # Mock tax calculation to return 0 for simplicity
        calculate_tax_mock.reset_mock(side_effect=True)
        calculate_tax_mock.return_value = (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": 0,
                "tax_behavior": TaxBehavior.exclusive,
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.0,
                        "display_name": "Tax",
                        "country": "FR",
                        "state": None,
                        "subdivision": None,
                        "amount": 0,
                        "taxability_reason": TaxabilityReason.not_subject_to_tax,
                    }
                ],
            },
            TaxProcessor.numeral,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.applied_balance_amount == -50_00
        assert order.total_amount == 50_00
        assert order.due_amount == 0
        assert order.status == OrderStatus.paid

        new_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, subscription.currency
        )
        assert new_balance == 50_00

    async def test_positive_order_negative_customer_balance(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        # Establish customer balance
        await create_wallet_billing(
            save_fixture,
            customer=customer,
            initial_balance=-50,
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        price = product.prices[0]
        assert is_fixed_price(price)

        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=50_00,
            currency=price.price_currency,
            subscription=subscription,
        )

        # Mock tax calculation to return 0 for simplicity
        calculate_tax_mock.reset_mock(side_effect=True)
        calculate_tax_mock.return_value = (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": 0,
                "tax_behavior": TaxBehavior.exclusive,
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.0,
                        "display_name": "Tax",
                        "country": "FR",
                        "state": None,
                        "subdivision": None,
                        "amount": 0,
                        "taxability_reason": TaxabilityReason.not_subject_to_tax,
                    }
                ],
            },
            TaxProcessor.numeral,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.applied_balance_amount == 50
        assert order.total_amount == 50_00
        assert order.due_amount == 50_50  # Carry over the outstanding balance
        assert order.status == OrderStatus.pending

        new_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, subscription.currency
        )
        assert new_balance == 0

    async def test_negative_order_positive_customer_balance(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        # Establish customer balance
        await create_wallet_billing(
            save_fixture,
            customer=customer,
            initial_balance=100_00,
        )

        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        price = product.prices[0]
        assert is_fixed_price(price)

        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=-50_00,
            currency=price.price_currency,
            subscription=subscription,
        )

        # Mock tax calculation to return 0 for simplicity
        calculate_tax_mock.reset_mock(side_effect=True)
        calculate_tax_mock.return_value = (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": 0,
                "tax_behavior": TaxBehavior.exclusive,
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.0,
                        "display_name": "Tax",
                        "country": "FR",
                        "state": None,
                        "subdivision": None,
                        "amount": 0,
                        "taxability_reason": TaxabilityReason.not_subject_to_tax,
                    }
                ],
            },
            TaxProcessor.numeral,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.applied_balance_amount == 0
        assert order.total_amount == -50_00
        assert order.due_amount == 0
        assert order.status == OrderStatus.paid

        new_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, subscription.currency
        )
        assert new_balance == 150_00

    async def test_negative_order_negative_customer_balance(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        # Establish customer balance
        await create_wallet_billing(
            save_fixture,
            customer=customer,
            initial_balance=-50,
        )

        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        price = product.prices[0]
        assert is_fixed_price(price)

        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=subscription.customer,
            product_price=price,
            amount=-50_00,
            currency=price.price_currency,
            subscription=subscription,
        )

        # Mock tax calculation to return 0 for simplicity
        calculate_tax_mock.reset_mock(side_effect=True)
        calculate_tax_mock.return_value = (
            {
                "processor_id": "TAX_PROCESSOR_ID",
                "amount": 0,
                "tax_behavior": TaxBehavior.exclusive,
                "tax_breakdown": [
                    {
                        "rate_type": "percentage",
                        "rate": 0.0,
                        "display_name": "Tax",
                        "country": "FR",
                        "state": None,
                        "subdivision": None,
                        "amount": 0,
                        "taxability_reason": TaxabilityReason.not_subject_to_tax,
                    }
                ],
            },
            TaxProcessor.numeral,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.applied_balance_amount == 50
        assert order.total_amount == -50_00
        assert order.due_amount == 0
        assert order.status == OrderStatus.paid

        new_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, subscription.currency
        )
        assert new_balance == 49_50

    async def test_sync_mode_null_payment_method_fallback_to_customer_default(
        self,
        mocker: MockerFixture,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        """When subscription.payment_method_id is None but customer has a default PM,
        sync mode should use the customer's default PM and succeed."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        default_pm = await create_payment_method(save_fixture, customer=customer)
        customer.default_payment_method = default_pm
        await save_fixture(customer)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        assert subscription.payment_method is None

        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        trigger_payment_mock = mocker.patch.object(
            order_service, "trigger_payment", new_callable=AsyncMock
        )

        order = await order_service.create_subscription_order(
            session,
            subscription,
            OrderBillingReasonInternal.subscription_cycle,
            payment_mode=PaymentMode.sync,
        )

        trigger_payment_mock.assert_called_once()
        call_args = trigger_payment_mock.call_args
        assert call_args.args[2].id == default_pm.id

    async def test_sync_under_minimum_emits_paid_transition_once(
        self,
        mocker: MockerFixture,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
        payment_method: PaymentMethod,
    ) -> None:
        # A sub-minimum sync charge (typical of a proration) is settled inside
        # trigger_payment, which already emits the paid transition.
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=customer,
            product_price=price,
            amount=10,
            currency=price.price_currency,
            subscription=subscription,
        )

        on_order_paid_spy = mocker.spy(order_service, "_on_order_paid")

        order = await order_service.create_subscription_order(
            session,
            subscription,
            OrderBillingReasonInternal.subscription_update,
            payment_mode=PaymentMode.sync,
        )

        assert order.status == OrderStatus.paid
        assert order.due_amount < get_minimum_currency_amount(order.currency)
        assert on_order_paid_spy.await_count == 1
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.confirmation_email", order.id)
            )
            == 1
        )

    async def test_zero_due_emits_paid_transition_once(
        self,
        mocker: MockerFixture,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
        payment_method: PaymentMethod,
    ) -> None:
        # A zero-due cycle settles without any charge, so the branch marking it
        # paid owns the transition that sends the confirmation.
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=customer,
            product_price=price,
            amount=0,
            currency=price.price_currency,
            subscription=subscription,
        )

        on_order_paid_spy = mocker.spy(order_service, "_on_order_paid")

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.due_amount == 0
        assert order.status == OrderStatus.paid
        assert on_order_paid_spy.await_count == 1
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.confirmation_email", order.id)
            )
            == 1
        )

    async def test_missing_payment_method_emits_order_updated_with_dunning_state(
        self,
        mocker: MockerFixture,
        calculate_tax_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
    ) -> None:
        # `order.created` is emitted before dunning starts, so merchants only
        # learn the retry schedule from the follow-up `order.updated`.
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        assert subscription.payment_method is None
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        send_webhook_mock = mocker.patch.object(order_service, "send_webhook")

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.next_payment_attempt_at is not None
        send_webhook_mock.assert_any_await(
            session, order, WebhookEventType.order_updated
        )

    async def test_cycle_does_not_send_confirmation_email_before_payment(
        self,
        calculate_tax_mock: MagicMock,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        organization: Organization,
        payment_method: PaymentMethod,
    ) -> None:
        # The async cycle order is created `pending` and charged by a later task,
        # so a confirmation must not be promised before the charge is attempted.
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )
        price = product.prices[0]
        assert is_fixed_price(price)
        await create_billing_entry(
            save_fixture,
            type=BillingEntryType.cycle,
            customer=customer,
            product_price=price,
            amount=price.price_amount,
            currency=price.price_currency,
            subscription=subscription,
        )

        order = await order_service.create_subscription_order(
            session, subscription, OrderBillingReasonInternal.subscription_cycle
        )

        assert order.status == OrderStatus.pending
        assert (
            call("order.confirmation_email", order.id)
            not in enqueue_job_mock.call_args_list
        )


@pytest.mark.asyncio
class TestCreateTrialOrder:
    async def test_not_trial(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        with pytest.raises(SubscriptionNotTrialing):
            await order_service.create_trial_order(
                session, subscription, OrderBillingReasonInternal.subscription_create
            )

    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )

        order = await order_service.create_trial_order(
            session, subscription, OrderBillingReasonInternal.subscription_create
        )

        assert order.total_amount == 0
        assert order.net_amount == 0
        assert order.status == OrderStatus.paid
        assert order.billing_reason == OrderBillingReasonInternal.subscription_create
        assert order.customer == subscription.customer
        assert order.product == product
        assert order.subscription == subscription
        assert len(order.items) == 1


@pytest.mark.asyncio
class TestCreateWalletOrder:
    async def test_basic(
        self,
        enqueue_job_mock: MagicMock,
        tax_service_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )
        wallet = await create_wallet(
            save_fixture, customer=customer, type=WalletType.usage
        )
        wallet_transaction = await create_wallet_transaction(
            save_fixture,
            wallet=wallet,
            amount=100_00,
            tax_amount=20_00,
            tax_breakdown=[
                {
                    "rate_type": "percentage",
                    "rate": 0.2,
                    "display_name": "Tax",
                    "country": "US",
                    "state": None,
                    "subdivision": None,
                    "amount": 20_00,
                    "taxability_reason": TaxabilityReason.standard_rated,
                }
            ],
            tax_calculation_processor_id="TAX_CALCULATION_ID",
        )
        payment = await create_payment(
            save_fixture,
            organization,
            amount=120_00,
            status=PaymentStatus.succeeded,
        )

        order = await order_service.create_wallet_order(
            session, wallet_transaction, payment=payment
        )

        assert order.status == OrderStatus.paid
        assert order.subtotal_amount == 100_00
        assert order.tax_amount == 20_00
        assert order.total_amount == 120_00
        assert order.tax_breakdown is not None
        assert len(order.tax_breakdown) == 1
        assert order.tax_breakdown[0]["amount"] == 20_00
        assert (
            order.tax_breakdown[0]["taxability_reason"]
            == TaxabilityReason.standard_rated
        )

        enqueue_job_mock.assert_any_call(
            "order.balance", order_id=order.id, charge_id=payment.processor_id
        )
        assert payment.order == order

        assert wallet_transaction.order == order

        tax_service_mock.record.assert_called_once()


@pytest.mark.asyncio
class TestCreateOrderBalance:
    async def test_no_payment_transaction(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        with pytest.raises(PaymentTransactionForChargeDoesNotExist):
            await order_service.create_order_balance(session, order, "CHARGE_ID")

    async def test_valid(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        account: Account,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        payment_transaction = await create_transaction(
            save_fixture, type=TransactionType.payment, charge_id="CHARGE_ID"
        )

        create_balance_from_charge_mock = mocker.patch(
            "polar.order.service.balance_transaction_service.create_balance_from_charge"
        )
        create_balance_from_charge_mock.return_value = (
            Transaction(type=TransactionType.balance, amount=-order.net_amount),
            Transaction(
                type=TransactionType.balance,
                amount=order.net_amount,
                account=account,
            ),
        )

        platform_fee_transaction_service_mock = mocker.patch(
            "polar.order.service.platform_fee_transaction_service",
            spec=PlatformFeeTransactionService,
        )
        platform_fee_transaction_service_mock.create_fees_reversal_balances.return_value = [
            (
                Transaction(
                    type=TransactionType.balance,
                    amount=-100,
                    currency="usd",
                    platform_fee_type=PlatformFeeType.payment,
                ),
                Transaction(
                    type=TransactionType.balance,
                    amount=100,
                    currency="usd",
                    platform_fee_type=PlatformFeeType.payment,
                    account=account,
                ),
            ),
            (
                Transaction(
                    type=TransactionType.balance,
                    amount=-50,
                    currency="usd",
                    platform_fee_type=PlatformFeeType.payment,
                ),
                Transaction(
                    type=TransactionType.balance,
                    amount=50,
                    currency="usd",
                    platform_fee_type=PlatformFeeType.payment,
                    account=account,
                ),
            ),
        ]

        await order_service.create_order_balance(session, order, "CHARGE_ID")

        assert create_balance_from_charge_mock.mock_calls[0] == call(
            ANY,
            source_account=None,
            destination_account=account,
            charge_id="CHARGE_ID",
            amount=payment_transaction.amount,
            order=order,
        )

        create_balance_from_charge_mock.assert_awaited_once_with(
            ANY,
            source_account=None,
            destination_account=account,
            charge_id="CHARGE_ID",
            amount=payment_transaction.amount,
            order=order,
        )

        platform_fee_transaction_service_mock.create_fees_reversal_balances.assert_called_once()
        assert order.platform_fee_amount == 150
        assert order.platform_fee_currency == "usd"

        updated_payment_transaction = await payment_transaction_service.get(
            session,
            id=payment_transaction.id,
            options=(joinedload(Transaction.payment_customer),),
        )
        assert updated_payment_transaction is not None
        assert updated_payment_transaction.order == order
        assert updated_payment_transaction.payment_customer == order.customer


@pytest.mark.asyncio
class TestSendConfirmationEmail:
    async def test_billing_not_set(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        create_order_invoice_mock = mocker.patch(
            "polar.order.service.invoice_service.create_order_invoice",
            new_callable=AsyncMock,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )

        await order_service.send_confirmation_email(session, order)

        assert order.invoice_path is None
        create_order_invoice_mock.assert_not_called()
        enqueue_email_mock.assert_called_once()
        assert isinstance(enqueue_email_mock.call_args[0][0], OrderConfirmationEmail)
        attachments = enqueue_email_mock.call_args[1]["attachments"]
        assert len(attachments) == 0

    async def test_billing_set(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        create_order_invoice_mock = mocker.patch(
            "polar.order.service.invoice_service.create_order_invoice",
            new_callable=AsyncMock,
            return_value="invoices/mock-invoice.pdf",
        )
        get_order_invoice_url_mock = mocker.patch(
            "polar.order.service.invoice_service.get_order_invoice_url",
            new_callable=AsyncMock,
            return_value=("https://mock-s3/invoices/mock-invoice.pdf", utc_now()),
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

        await order_service.send_confirmation_email(session, order)

        assert order.invoice_path is not None
        create_order_invoice_mock.assert_called_once_with(order)
        get_order_invoice_url_mock.assert_called_once()
        enqueue_email_mock.assert_called_once()
        assert isinstance(enqueue_email_mock.call_args[0][0], OrderConfirmationEmail)
        attachments = enqueue_email_mock.call_args[1]["attachments"]
        assert len(attachments) == 1

    async def test_excludes_non_public_benefits(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        organization: Organization,
    ) -> None:
        mocker.patch(
            "polar.order.service.invoice_service.create_order_invoice",
            new_callable=AsyncMock,
        )
        public_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Public benefit",
        )
        private_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Private benefit",
        )
        private_benefit.visibility = Visibility.private
        await save_fixture(private_benefit)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
        )
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[public_benefit, private_benefit],
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
        )

        await order_service.send_confirmation_email(session, order)

        email = enqueue_email_mock.call_args[0][0]
        assert isinstance(email, OrderConfirmationEmail)
        assert email.props.product is not None
        assert [benefit.description for benefit in email.props.product.benefits] == [
            "Public benefit"
        ]


@pytest.mark.asyncio
class TestTriggerInvoiceGeneration:
    async def test_not_paid_triggers_generation(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

        await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_called_once_with("order.invoice", order_id=order.id)

    async def test_draft_order_raises(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

        with pytest.raises(OrderNotEligibleForInvoice):
            await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_not_called()

    async def test_void_order_raises(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.void,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

        with pytest.raises(OrderNotEligibleForInvoice):
            await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_not_called()

    async def test_missing_billing(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)

        with pytest.raises(MissingInvoiceBillingDetails):
            await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_not_called()

    async def test_no_existing_invoice(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

        await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_called_once_with("order.invoice", order_id=order.id)

    async def test_existing_invoice_no_checksum(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )
        order.invoice_path = "invoices/legacy.pdf"

        await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_called_once_with("order.invoice", order_id=order.id)

    async def test_checksum_mismatch(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )
        order.invoice_path = "invoices/old.pdf"
        order.invoice_checksum = "stale"

        await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_called_once_with("order.invoice", order_id=order.id)

    async def test_checksum_match_skips(
        self,
        enqueue_job_mock: MagicMock,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )
        order.invoice_path = "invoices/current.pdf"
        order.invoice_checksum = invoice_service.compute_order_checksum(order)

        await order_service.trigger_invoice_generation(session, order)

        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestGenerateInvoice:
    async def test_persists_checksum(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        mocker.patch(
            "polar.order.service.invoice_service.create_order_invoice",
            new_callable=AsyncMock,
            return_value="invoices/generated.pdf",
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )

        updated = await order_service.generate_invoice(session, order)

        assert updated.invoice_path == "invoices/generated.pdf"
        assert updated.invoice_checksum == invoice_service.compute_order_checksum(
            updated
        )

    async def test_skips_when_checksum_matches(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        create_order_invoice_mock = mocker.patch(
            "polar.order.service.invoice_service.create_order_invoice",
            new_callable=AsyncMock,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            billing_name="John Doe",
            billing_address=Address(country=CountryAlpha2("US")),
        )
        order.invoice_path = "invoices/current.pdf"
        order.invoice_checksum = invoice_service.compute_order_checksum(order)

        result = await order_service.generate_invoice(session, order)

        assert result is order
        create_order_invoice_mock.assert_not_called()


@pytest.mark.asyncio
class TestHandlePayment:
    async def test_already_paid_is_idempotent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # An already-paid order is a no-op: the success path may run inline
        # (from finalize_order) and then again from charge.succeeded.
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
        )

        result = await order_service.handle_payment(session, order, None)
        assert result is order
        assert result.status == OrderStatus.paid

    async def test_sends_confirmation_email_once_on_paid_transition(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        payment = await create_payment(
            save_fixture, organization, processor_id="ch_cycle_success"
        )

        result = await order_service.handle_payment(session, order, payment)

        assert result.status == OrderStatus.paid
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.confirmation_email", order.id)
            )
            == 1
        )

    async def test_order_not_pending_raises_for_non_paid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.refunded,
        )

        with pytest.raises(OrderNotPending):
            await order_service.handle_payment(session, order, None)

    async def test_full_case_with_payment_and_tax(
        self,
        enqueue_job_mock: MagicMock,
        tax_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Create a pending order with tax calculation processor ID
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        # Set tax_calculation_processor_id
        order.tax_processor = TaxProcessor.stripe
        order.tax_calculation_processor_id = "tax_calc_123"
        order.tax_behavior = TaxBehavior.exclusive
        await save_fixture(order)

        # Create a payment
        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_123",
        )

        # Call handle_payment
        updated_order = await order_service.handle_payment(session, order, payment)

        # Verify order status is updated to paid
        assert updated_order.status == OrderStatus.paid
        assert updated_order.tax_transaction_processor_id == "TAX_TRANSACTION_ID"

        # Verify enqueue_job was called to balance the order
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.balance", order_id=order.id, charge_id="stripe_payment_123")
            )
            == 1
        )

        # Verify tax transaction was created
        tax_service_mock.record.assert_called_once()

    async def test_tax_recalculated_on_calculation_expired_error(
        self,
        enqueue_job_mock: MagicMock,
        tax_service_mock: MagicMock,
        calculate_tax_mock: AsyncMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
    ) -> None:
        # Create a customer with a billing address so that _calculate_tax
        # will actually invoke tax_calculation_service.calculate and produce a non-zero amount.
        # The mocked calculate returns polar_round(amount * 0.20), so for net_amount=1000 → 200.
        customer_with_address = await create_customer(
            save_fixture,
            organization=organization,
            billing_address=Address(country=CountryAlpha2("FR")),
        )

        # Set tax_amount=200 to match the recalculated amount so no TaxCalculationChangedAfterPayment is raised
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer_with_address,
            status=OrderStatus.pending,
            subtotal_amount=1000,
            tax_amount=200,
            billing_address=customer_with_address.billing_address,
        )

        order.tax_processor = TaxProcessor.stripe
        order.tax_calculation_processor_id = "tax_calc_expired_123"
        order.tax_behavior = TaxBehavior.exclusive
        await save_fixture(order)

        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_456",
        )

        # First call to record raises CalculationExpiredError; second call (after recalculation) succeeds
        tax_service_mock.record.side_effect = [
            CalculationExpiredError(),
            ("NEW_TAX_TRANSACTION_ID", TaxProcessor.numeral),
        ]

        updated_order = await order_service.handle_payment(session, order, payment)

        # Order should be marked paid
        assert updated_order.status == OrderStatus.paid

        # Tax should have been recalculated via calculate
        calculate_tax_mock.assert_called_once()

        # record should have been called twice: once failing with the expired ID,
        # once succeeding with the newly recalculated calculation ID
        assert tax_service_mock.record.call_count == 2
        first_record_call, second_record_call = tax_service_mock.record.call_args_list
        assert first_record_call.args[1] == "tax_calc_expired_123"
        assert second_record_call.args[1] == "TAX_PROCESSOR_ID"

        # The tax transaction processor ID should reflect the second (successful) record call
        assert updated_order.tax_transaction_processor_id == "NEW_TAX_TRANSACTION_ID"
        assert updated_order.tax_processor == TaxProcessor.numeral

        # The balance job should still be enqueued
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.balance", order_id=order.id, charge_id="stripe_payment_456")
            )
            == 1
        )


@pytest.mark.asyncio
class TestHandlePaymentFailure:
    """Test order service handle payment failure functionality"""

    @freeze_time("2024-01-01 12:00:00")
    async def test_subscription_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service handles payment failure for subscription orders"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_mark_past_due.return_value = subscription

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_called_once_with(session, subscription)

    @freeze_time("2024-01-01 12:00:00")
    async def test_first_dunning_enqueues_benefit_revocation(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """When a subscription product update grants benefits before payment,
        the first dunning attempt must re-enqueue benefit grants so that
        benefits are revoked for the now past-due subscription."""
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_mark_past_due.return_value = subscription

        mock_enqueue_benefits_grants = mocker.patch(
            "polar.subscription.service.subscription.enqueue_benefits_grants"
        )

        await order_service.handle_payment_failure(session, order)

        mock_mark_past_due.assert_called_once_with(session, subscription)
        mock_enqueue_benefits_grants.assert_called_once_with(session, subscription)

    @freeze_time("2024-01-01 12:00:00")
    async def test_first_dunning_attempt_skips_ended_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """A dunning order that fires after the subscription has already
        ended must not progress dunning or overwrite the terminal status."""
        # Given
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
            revoke=True,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_ignores_payment_failure_for_already_paid_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that payment failure is ignored for orders that are already paid"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.paid,  # Order is already paid
            payment_lock_acquired_at=utc_now(),
        )
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None  # No retry scheduled
        assert result_order.status == OrderStatus.paid  # Status unchanged
        assert result_order.payment_lock_acquired_at is None  # Lock is released
        mock_mark_past_due.assert_not_called()  # Subscription not marked past_due

    async def test_non_subscription_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service skips dunning for non-subscription orders"""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None

        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_consecutive_first_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that the second retry is scheduled after the first retry fails.

        At this point there are 2 failed payments on the order: the initial
        subscription_cycle failure and the just-failed first retry.
        """
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Initial cycle failure + just-failed first retry already recorded
        for _ in range(2):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.purchase,
                order=order,
            )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        # Should schedule second retry (5 days from now, as per DUNNING_RETRY_INTERVALS[1])
        expected_retry_date = utc_now() + timedelta(days=5)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_consecutive_second_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that the third retry is scheduled after the second retry fails.

        At this point there are 3 failed payments on the order: the initial
        subscription_cycle failure and the two retries that have failed.
        """
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Initial cycle failure + two failed retries already recorded
        for _ in range(3):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.purchase,
                order=order,
            )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        # Should schedule third retry (7 days from now, as per DUNNING_RETRY_INTERVALS[2])
        expected_retry_date = utc_now() + timedelta(days=7)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_final_attempt_cancels_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service cancels subscription after final retry attempt.

        Initial cycle failure + all DUNNING_RETRY_INTERVALS retries have
        failed, so the configured retry budget is exhausted.
        """
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Initial cycle failure + DUNNING_RETRY_INTERVALS retries all failed
        for _ in range(len(settings.DUNNING_RETRY_INTERVALS) + 1):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.purchase,
                order=order,
            )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_called_once_with(session, ANY, subscription)
        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_final_attempt_canceled_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service cancels subscription after final retry attempt"""
        # Given
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            customer=customer,
            revoke=True,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # Initial cycle failure + DUNNING_RETRY_INTERVALS retries all failed
        for _ in range(len(settings.DUNNING_RETRY_INTERVALS) + 1):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.purchase,
                order=order,
            )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_not_called()
        mock_mark_past_due.assert_not_called()

    @freeze_time("2024-01-01 12:00:00")
    async def test_only_failed_payments_counted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that order service only counts failed payments, not successful ones"""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        # 2 failed payments (cycle + first retry) and 1 unrelated success
        for _ in range(2):
            await create_payment(
                save_fixture,
                order.organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.purchase,
                order=order,
            )
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.succeeded,
            order=order,
        )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is not None
        # Should schedule second retry (5 days) since 2 failed payments exist
        expected_retry_date = utc_now() + timedelta(days=5)
        assert result_order.next_payment_attempt_at == expected_retry_date

        mock_mark_past_due.assert_not_called()

    @freeze_time("2025-01-22 01:00:00")
    async def test_past_due_deadline_reached(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """
        Test that order service cancels subscription
        after the subscription's past due deadline is reached,
        even if we didn't record enough failed payments.
        """
        # Given
        subscription = await create_subscription(
            save_fixture,
            status=SubscriptionStatus.past_due,
            past_due_at=datetime(2025, 1, 1, 0, 0, 0, tzinfo=UTC),
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_called_once()

    async def test_void_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """
        Test that order retries are stopped if order is void.
        """
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.void,
        )
        order.next_payment_attempt_at = utc_now() - timedelta(days=1)  # Past due
        await save_fixture(order)

        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_called_once()

    @freeze_time("2024-01-01 12:00:00")
    async def test_void_order_with_null_next_payment_attempt(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that handle_payment_failure does not set next_payment_attempt_at
        for void orders when next_payment_attempt_at is None.

        This prevents the inconsistent state where status=void but
        next_payment_attempt_at is not None.
        """
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.void,
            next_payment_attempt_at=None,
        )
        await save_fixture(order)

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then - next_payment_attempt_at should remain None for void orders
        assert result_order.next_payment_attempt_at is None
        assert result_order.status == OrderStatus.void

    @freeze_time("2024-01-01 12:00:00")
    async def test_non_recoverable_decline_code_skips_dunning(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """When a payment fails with a non-recoverable decline code (e.g., stolen_card),
        the subscription should be marked as past_due and next_payment_attempt_at
        set to the past_due_deadline so the dunning worker can revoke it."""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        # Create a failed payment with a non-recoverable decline reason
        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            decline_reason="stolen_card",
            trigger=PaymentTrigger.purchase,
            order=order,
        )

        async def mark_past_due_side_effect(
            session: AsyncSession, sub: Subscription
        ) -> Subscription:
            sub.status = SubscriptionStatus.past_due
            sub.past_due_at = utc_now()
            return sub

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due",
            side_effect=mark_past_due_side_effect,
        )

        mock_enqueue_benefits_grants = mocker.patch(
            "polar.subscription.service.subscription.enqueue_benefits_grants"
        )

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then — next attempt at past_due_deadline so worker can revoke
        assert result_order.next_payment_attempt_at == subscription.past_due_deadline
        assert result_order.next_payment_attempt_at is not None
        # Subscription marked as past_due
        mock_mark_past_due.assert_called_once_with(session, subscription)
        mock_enqueue_benefits_grants.assert_called_once_with(session, subscription)

    @freeze_time("2024-01-01 12:00:00")
    async def test_recoverable_decline_enters_dunning(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """When a payment fails with a recoverable decline reason
        (e.g., insufficient_funds), the normal dunning retry flow should proceed."""
        # Given
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = None
        await save_fixture(order)

        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            decline_reason="insufficient_funds",
            trigger=PaymentTrigger.purchase,
            order=order,
        )

        mock_mark_past_due = mocker.patch(
            "polar.subscription.service.subscription.mark_past_due"
        )
        mock_mark_past_due.return_value = subscription

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then — normal dunning: retry scheduled
        assert result_order.next_payment_attempt_at is not None
        expected_retry_date = utc_now() + timedelta(days=2)
        assert result_order.next_payment_attempt_at == expected_retry_date
        mock_mark_past_due.assert_called_once_with(session, subscription)

    @freeze_time("2024-02-01 12:00:00")
    async def test_non_recoverable_revokes_at_past_due_deadline(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """When the dunning worker re-processes a non-recoverable order after
        the past_due_deadline has passed, the subscription should be revoked."""
        # Given — subscription already past_due with deadline in the past
        past_due_at = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)
        subscription = await create_subscription(
            save_fixture,
            status=SubscriptionStatus.past_due,
            past_due_at=past_due_at,
            product=product,
            customer=customer,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        # Was scheduled at past_due_deadline (now in the past)
        order.next_payment_attempt_at = subscription.past_due_deadline
        await save_fixture(order)

        await create_payment(
            save_fixture,
            order.organization,
            status=PaymentStatus.failed,
            decline_reason="stolen_card",
            trigger=PaymentTrigger.purchase,
            order=order,
        )

        mock_revoke = mocker.patch("polar.subscription.service.subscription.revoke")

        # When
        result_order = await order_service.handle_payment_failure(session, order)

        # Then — subscription revoked, no further retries
        assert result_order.next_payment_attempt_at is None
        mock_revoke.assert_called_once_with(session, ANY, subscription)


@pytest.mark.asyncio
class TestProcessDunningOrder:
    """Test order service process dunning order functionality"""

    async def test_process_dunning_order_no_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
    ) -> None:
        """Test that process_dunning_order logs warning for orders without subscription"""
        # Given
        log_mock = mocker.patch("polar.order.service.log")
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )

        # When
        await order_service.process_dunning_order(session, order)

        # Then
        log_mock.warning.assert_called_once_with(
            "Order has no subscription, skipping dunning",
            order_id=order.id,
        )

    async def test_process_dunning_order_cancelled_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test that process_dunning_order removes retry date for cancelled subscriptions"""
        # Given - create a subscription and manually set it to canceled status
        subscription = await create_canceled_subscription(
            save_fixture,
            customer=customer,
            product=product,
        )
        subscription.status = SubscriptionStatus.canceled
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method = payment_method
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        order.next_payment_attempt_at = utc_now() + timedelta(days=1)
        await save_fixture(order)

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        assert order.next_payment_attempt_at is None

    async def test_process_dunning_order_no_payment_method(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        mocker: MockerFixture,
    ) -> None:
        """Test that process_dunning_order logs warning for subscriptions without payment method"""
        # Given
        log_mock = mocker.patch("polar.order.service.log")
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        subscription.payment_method_id = None
        await save_fixture(subscription)

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        enqueue_job_mock.assert_not_called()
        log_mock.warning.assert_called_once_with(
            "Order subscription has no payment method, record a failure",
            order_id=order.id,
            subscription_id=subscription.id,
        )

    async def test_process_dunning_order_soft_deleted_payment_method(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        mocker: MockerFixture,
    ) -> None:
        """Test that process_dunning_order logs warning for subscriptions with a soft deleted payment method"""
        # Given
        log_mock = mocker.patch("polar.order.service.log")
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )
        payment_method = await create_payment_method(save_fixture, customer=customer)
        payment_method.set_deleted_at()
        await save_fixture(payment_method)

        subscription.payment_method = payment_method
        await save_fixture(subscription)

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        enqueue_job_mock.assert_not_called()
        log_mock.warning.assert_called_once_with(
            "Order subscription has no payment method, record a failure",
            order_id=order.id,
            subscription_id=subscription.id,
        )

    async def test_process_dunning_order_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        enqueue_job_mock: MagicMock,
    ) -> None:
        """Test that process_dunning_order successfully enqueues payment retry"""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method_id = payment_method.id

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        # When
        order = await order_service.process_dunning_order(session, order)

        # Then
        enqueue_job_mock.assert_called_once_with(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=payment_method.id,
            payment_trigger="retry_dunning",
        )

    async def test_process_dunning_order_void_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        subscription: Subscription,
        mocker: MockerFixture,
    ) -> None:
        """Test that process_dunning_order skips void orders."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription.payment_method = payment_method
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.void,
        )
        order.next_payment_attempt_at = utc_now() + timedelta(days=1)
        await save_fixture(order)

        # When
        result_order = await order_service.process_dunning_order(session, order)

        # Then - void orders should not be processed for dunning
        assert result_order.status == OrderStatus.void
        assert result_order.next_payment_attempt_at is None


@pytest.mark.asyncio
class TestScheduleRetryForPastDueOrders:
    """Test scheduling dunning retries when a customer saves a new payment method."""

    @freeze_time("2024-01-15 12:00:00")
    async def test_schedules_retry_for_past_due_no_next_attempt(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """When a customer saves a new payment method and has a past_due subscription
        with no next_payment_attempt_at, a payment should be enqueued immediately."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            past_due_at=datetime(2024, 1, 10, 0, 0, 0, tzinfo=UTC),
            payment_method=payment_method,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=None,
        )

        new_payment_method = await create_payment_method(
            save_fixture, customer=customer
        )

        # When
        await order_service.schedule_retry_for_past_due_orders(
            session, customer, new_payment_method
        )

        # Then
        enqueue_job_mock.assert_called_once_with(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=new_payment_method.id,
            payment_trigger="retry_payment_method_update",
        )

        await session.refresh(subscription)
        assert subscription.payment_method_id == new_payment_method.id

    @freeze_time("2024-01-15 12:00:00")
    async def test_skips_canceled_subscription(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Should NOT schedule retry for canceled subscriptions."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        # A past_due subscription that the customer has canceled
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            past_due_at=datetime(2024, 1, 10, 0, 0, 0, tzinfo=UTC),
            payment_method=payment_method,
            cancel_at_period_end=True,
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=None,
        )

        new_payment_method = await create_payment_method(
            save_fixture, customer=customer
        )

        # When
        await order_service.schedule_retry_for_past_due_orders(
            session, customer, new_payment_method
        )

        # Then — no retry scheduled
        enqueue_job_mock.assert_not_called()

    @freeze_time("2024-02-01 12:00:00")
    async def test_skips_past_deadline(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Should NOT schedule retry if the past_due_deadline has already passed."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        # past_due_at on Jan 1 → deadline ~Jan 15 (14 days + 1 min)
        # Current time is Feb 1 → well past the deadline
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            past_due_at=datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC),
            payment_method=payment_method,
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=None,
        )

        new_payment_method = await create_payment_method(
            save_fixture, customer=customer
        )

        # When
        await order_service.schedule_retry_for_past_due_orders(
            session, customer, new_payment_method
        )

        # Then — no retry scheduled (deadline expired)
        enqueue_job_mock.assert_not_called()

    @freeze_time("2024-01-15 12:00:00")
    async def test_enqueues_payment_if_next_attempt_already_set(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """When a customer saves a new payment method, a payment should be
        enqueued immediately even if next_payment_attempt_at was already set."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        existing_retry_date = datetime(2024, 1, 16, 0, 0, 0, tzinfo=UTC)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            past_due_at=datetime(2024, 1, 10, 0, 0, 0, tzinfo=UTC),
            payment_method=payment_method,
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=existing_retry_date,
        )

        new_payment_method = await create_payment_method(
            save_fixture, customer=customer
        )

        # When
        await order_service.schedule_retry_for_past_due_orders(
            session, customer, new_payment_method
        )

        # Then — payment enqueued immediately
        enqueue_job_mock.assert_called_once_with(
            "order.trigger_payment",
            order_id=order.id,
            payment_method_id=new_payment_method.id,
            payment_trigger="retry_payment_method_update",
        )

        await session.refresh(subscription)
        assert subscription.payment_method_id == new_payment_method.id

    @freeze_time("2024-01-15 12:00:00")
    async def test_skips_active_subscription(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Should NOT schedule retry for active subscriptions (not past_due)."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            payment_method=payment_method,
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=None,
        )

        new_payment_method = await create_payment_method(
            save_fixture, customer=customer
        )

        # When
        await order_service.schedule_retry_for_past_due_orders(
            session, customer, new_payment_method
        )

        # Then — no retry scheduled (subscription is active, not past_due)
        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestTriggerPayment:
    """Test payment lock mechanism in trigger_payment service method."""

    async def test_skips_denied_organization(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that trigger_payment skips payment when organization is denied."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        organization.set_status(OrganizationStatus.DENIED)
        await save_fixture(organization)

        await order_service.trigger_payment(session, order, payment_method)

        stripe_service_mock.create_payment_intent.assert_not_called()

    async def test_skips_blocked_organization(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that trigger_payment skips payment when organization is blocked."""
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        organization.set_status(OrganizationStatus.BLOCKED)
        await save_fixture(organization)

        await order_service.trigger_payment(session, order, payment_method)

        stripe_service_mock.create_payment_intent.assert_not_called()

    @pytest.mark.parametrize(
        ("trigger", "expected_payment_attempted"),
        [
            (PaymentTrigger.subscription_cycle, True),
            (PaymentTrigger.purchase, False),
        ],
    )
    async def test_capability_gate_distinguishes_renewals_from_checkouts(
        self,
        trigger: PaymentTrigger,
        expected_payment_attempted: bool,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        """An org with checkout_payments off but subscription_renewals on must
        process renewals while still blocking new checkouts."""
        organization.capabilities = {
            **organization.capabilities,
            "checkout_payments": False,
            "subscription_renewals": True,
        }
        await save_fixture(organization)
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        await order_service.trigger_payment(
            session, order, payment_method, payment_trigger=trigger
        )

        if expected_payment_attempted:
            stripe_service_mock.create_payment_intent.assert_called_once()
        else:
            stripe_service_mock.create_payment_intent.assert_not_called()

    async def test_already_locked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that trigger_payment raises PaymentAlreadyInProgress when order is already locked."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.payment_lock_acquired_at = utc_now()
        await save_fixture(order)

        # When/Then
        with pytest.raises(PaymentAlreadyInProgress):
            await order_service.trigger_payment(session, order, payment_method)

    async def test_acquires_lock_successfully(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that trigger_payment acquires lock and processes payment normally."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # When
        await order_service.trigger_payment(session, order, payment_method)

        # Then
        stripe_service_mock.create_payment_intent.assert_called_once()

        await session.refresh(order)
        assert order.payment_lock_acquired_at is not None

    async def test_releases_lock_on_failure(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that lock is released when payment processing fails."""
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        stripe_service_mock.create_payment_intent.side_effect = Exception(
            "Payment failed"
        )

        # When/Then
        with pytest.raises(Exception, match="Payment failed"):
            await order_service.trigger_payment(session, order, payment_method)

        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_card_error_raises_card_payment_failed(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # Mock Stripe service to raise CardError
        card_error = stripe_lib.CardError(
            message="Your card was declined.",
            param="card",
            code="card_declined",
        )
        stripe_service_mock.create_payment_intent.side_effect = card_error

        # When/Then
        with pytest.raises(PaymentFailed):
            await order_service.trigger_payment(session, order, payment_method)

        # Verify lock is released on failure
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_other_stripe_errors_not_converted(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # Mock Stripe service to raise APIConnectionError
        api_error = stripe_lib.APIConnectionError("Network connection failed")
        stripe_service_mock.create_payment_intent.side_effect = api_error

        # When/Then - should raise the original exception, not CardPaymentFailed
        with pytest.raises(stripe_lib.APIConnectionError) as exc_info:
            await order_service.trigger_payment(session, order, payment_method)

        assert str(exc_info.value) == "Network connection failed"

        # Verify lock is released on failure
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    @pytest.mark.parametrize(
        "error_message",
        [
            "This PaymentMethod requires a mandate",
            "The payment method has been detached from a customer",
            "The payment method does not belong to the customer",
        ],
    )
    async def test_invalid_payment_method_error_triggers_deletion(
        self,
        error_message: str,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        invalid_request_error = stripe_lib.InvalidRequestError(
            error_message,
            param="payment_method",
            json_body={"error": {"message": error_message}},
        )
        stripe_service_mock.create_payment_intent.side_effect = invalid_request_error

        delete_mock = mocker.patch(
            "polar.order.service.payment_method_service.delete", new=AsyncMock()
        )

        # When/Then
        with pytest.raises(PaymentFailed):
            await order_service.trigger_payment(session, order, payment_method)

        delete_mock.assert_called_once()

    async def test_unrelated_invalid_request_error_not_caught(
        self,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        # An unrelated InvalidRequestError should NOT trigger payment method deletion
        invalid_request_error = stripe_lib.InvalidRequestError(
            "Amount must be at least 50 cents",
            param="amount",
            json_body={"error": {"message": "Amount must be at least 50 cents"}},
        )
        stripe_service_mock.create_payment_intent.side_effect = invalid_request_error

        delete_mock = mocker.patch(
            "polar.order.service.payment_method_service.delete", new=AsyncMock()
        )

        # When/Then - should re-raise the original error, not catch it
        with pytest.raises(stripe_lib.InvalidRequestError):
            await order_service.trigger_payment(session, order, payment_method)

        delete_mock.assert_not_called()

    async def test_due_amount_less_than_50(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subtotal_amount=10,
        )
        await save_fixture(order)

        # When
        await order_service.trigger_payment(session, order, payment_method)

        # Then
        stripe_service_mock.create_payment_intent.assert_not_called()

        await session.refresh(order)
        assert order.status == OrderStatus.paid
        assert order.payment_lock_acquired_at is None

        customer_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, order.currency
        )
        assert customer_balance == -10

    async def test_applied_balance_amount(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        # Given
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subtotal_amount=50_00,
            applied_balance_amount=50,
        )
        await save_fixture(order)

        # When
        await order_service.trigger_payment(session, order, payment_method)

        # Then
        stripe_service_mock.create_payment_intent.assert_called_once()
        amount = stripe_service_mock.create_payment_intent.call_args[1]["amount"]
        assert amount == 50_50

        await session.refresh(order)
        assert order.payment_lock_acquired_at is not None

    async def test_statement_descriptor_regular_subscription_cycle(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
        )
        await save_fixture(order)

        await order_service.trigger_payment(session, order, payment_method)

        stripe_service_mock.create_payment_intent.assert_called_once()
        call_kwargs = stripe_service_mock.create_payment_intent.call_args[1]
        assert (
            call_kwargs["statement_descriptor_suffix"]
            == organization.statement_descriptor()
        )

    async def test_statement_descriptor_after_trial(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer=customer)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
            billing_reason=OrderBillingReasonInternal.subscription_cycle_after_trial,
        )
        await save_fixture(order)

        await order_service.trigger_payment(session, order, payment_method)

        stripe_service_mock.create_payment_intent.assert_called_once()
        call_kwargs = stripe_service_mock.create_payment_intent.call_args[1]

        descriptor = call_kwargs["statement_descriptor_suffix"]
        assert descriptor.endswith(" TRIAL OVER")
        from polar.config import settings

        assert len(descriptor) <= settings.stripe_descriptor_suffix_max_length
        assert descriptor.startswith(organization.slug[:4])


@pytest.mark.asyncio
class TestAcquirePaymentLock:
    async def test_acquire_payment_lock_success(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test successful payment lock acquisition."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        async with order_service.acquire_payment_lock(session, order):
            await session.refresh(order)
            assert order.payment_lock_acquired_at is not None

        # Lock is held after context (released by the webhook handler)
        await session.refresh(order)
        assert order.payment_lock_acquired_at is not None

    async def test_acquire_payment_lock_already_acquired(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test acquiring lock when already acquired raises exception."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.payment_lock_acquired_at = utc_now()
        await save_fixture(order)

        with pytest.raises(PaymentAlreadyInProgress):
            async with order_service.acquire_payment_lock(session, order):
                pass

    async def test_acquire_payment_lock_release_on_exception(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test lock is released when exception occurs in context."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        await save_fixture(order)

        with pytest.raises(ValueError, match="Test exception"):
            async with order_service.acquire_payment_lock(session, order):
                await session.refresh(order)
                assert order.payment_lock_acquired_at is not None
                raise ValueError("Test exception")

        # Lock should be released after exception
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None


@pytest.mark.asyncio
class TestProcessRetryPayment:
    async def test_process_retry_payment_success(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test successful retry payment processing."""
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "succeeded"
        mock_payment_intent.client_secret = None
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "succeeded"
        assert result.client_secret is None
        assert result.error is None

        stripe_service_mock.create_payment_intent.assert_called_once()

    async def test_process_retry_payment_requires_action(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test retry payment requiring additional action."""
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "requires_action"
        mock_payment_intent.client_secret = "pi_test_client_secret"
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "requires_action"
        assert result.client_secret == "pi_test_client_secret"
        assert result.error is None

    async def test_process_retry_payment_failed(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test failed retry payment."""
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )
        await save_fixture(order)

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "failed"
        mock_payment_intent.client_secret = None
        mock_payment_intent.last_payment_error = MagicMock()
        mock_payment_intent.last_payment_error.message = "Card was declined."
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "failed"
        assert result.client_secret is None
        assert result.error == "Card was declined."

    async def test_process_retry_payment_stripe_error(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test retry payment with Stripe error."""
        await save_fixture(customer)

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )
        await save_fixture(order)

        mock_error = MagicMock()
        mock_error.message = "Payment method not available."
        stripe_error = stripe_lib.StripeError("Payment method not available.")
        stripe_error.error = mock_error
        stripe_service_mock.create_payment_intent = AsyncMock(side_effect=stripe_error)

        result = await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert result.status == "failed"
        assert result.client_secret is None
        assert result.error == "Payment method not available."

    async def test_process_retry_payment_order_not_pending(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment with non-pending order."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,  # Not pending
        )
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_no_next_attempt(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment with no next payment attempt scheduled."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            next_payment_attempt_at=None,  # No retry scheduled
        )
        await save_fixture(order)

        with pytest.raises(OrderNotEligibleForRetry):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_no_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment with no subscription."""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            next_payment_attempt_at=utc_now(),
            subscription=None,  # No subscription
        )
        await save_fixture(order)

        from polar.order.service import OrderNotEligibleForRetry

        with pytest.raises(OrderNotEligibleForRetry):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_already_in_progress(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test retry payment when payment already in progress."""
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
            payment_lock_acquired_at=utc_now(),  # Lock already acquired
        )
        await save_fixture(order)

        with pytest.raises(PaymentAlreadyInProgress):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )

    async def test_process_retry_payment_lock_held_on_success(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test that payment lock is held (not released) when payment succeeds."""
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )

        mock_payment_intent = MagicMock()
        mock_payment_intent.id = "pi_test"
        mock_payment_intent.status = "succeeded"
        mock_payment_intent.client_secret = None
        stripe_service_mock.create_payment_intent = AsyncMock(
            return_value=mock_payment_intent
        )

        await order_service.process_retry_payment(
            session, order, "ctoken_test", PaymentProcessor.stripe
        )

        assert order.payment_lock_acquired_at is not None

    async def test_process_retry_payment_manual_retry_limit_exceeded(
        self,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        """Test that manual retry is rejected when the limit is exceeded."""
        from polar.config import settings

        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=utc_now(),
        )

        for _ in range(settings.CUSTOMER_RETRY_MAX_ATTEMPTS):
            await create_payment(
                save_fixture,
                organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.retry_customer,
                order=order,
            )

        with pytest.raises(ManualRetryLimitExceeded):
            await order_service.process_retry_payment(
                session, order, "ctoken_test", PaymentProcessor.stripe
            )


@pytest.mark.asyncio
class TestCustomerBasedInvoiceNumbering:
    async def test_different_customers_different_invoice_numbers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product_one_time: Product,
    ) -> None:
        # Set organization to use customer-based invoice numbering
        organization.order_settings = {
            **organization.order_settings,
            "invoice_numbering": InvoiceNumbering.customer,
        }
        await save_fixture(organization)

        customer_1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            name="Customer 1",
            stripe_customer_id="STRIPE_CUSTOMER_1",
        )
        customer_2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            name="Customer 2",
            stripe_customer_id="STRIPE_CUSTOMER_2",
        )

        checkout_1 = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer_1,
        )
        order_1 = await order_service.create_from_checkout_one_time(session, checkout_1)

        checkout_2 = await create_checkout(
            save_fixture,
            products=[product_one_time],
            status=CheckoutStatus.confirmed,
            customer=customer_2,
        )
        order_2 = await order_service.create_from_checkout_one_time(session, checkout_2)

        await session.refresh(order_1)
        await session.refresh(order_2)

        assert order_1.invoice_number is not None
        assert order_2.invoice_number is not None
        assert order_1.invoice_number != order_2.invoice_number

        assert order_1.invoice_number.startswith(organization.customer_invoice_prefix)
        assert order_2.invoice_number.startswith(organization.customer_invoice_prefix)

        assert order_1.invoice_number.endswith("-0001")
        assert order_2.invoice_number.endswith("-0001")

        await session.refresh(customer_1)
        await session.refresh(customer_2)
        assert customer_1.short_id_str in order_1.invoice_number
        assert customer_2.short_id_str in order_2.invoice_number

        assert (
            order_1.invoice_number
            == f"{organization.customer_invoice_prefix}-{customer_1.short_id_str}-0001"
        )
        assert (
            order_2.invoice_number
            == f"{organization.customer_invoice_prefix}-{customer_2.short_id_str}-0001"
        )


@pytest.mark.asyncio
@pytest.mark.asyncio
class TestUpdateProductBenefitsGrants:
    async def test_enqueues_jobs_for_one_time_orders(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
    ) -> None:
        """Test that jobs are enqueued for one-time orders"""
        customer1 = await create_customer(save_fixture, organization=organization)
        customer2 = await create_customer(
            save_fixture, organization=organization, email="customer2@example.com"
        )

        order1 = await create_order(
            save_fixture, product=product, customer=customer1, subscription=None
        )
        order2 = await create_order(
            save_fixture, product=product, customer=customer2, subscription=None
        )

        await order_service.update_product_benefits_grants(session, product)

        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer1.id,
            product_id=product.id,
            order_id=order1.id,
            delay=ANY,
        )
        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=customer2.id,
            product_id=product.id,
            order_id=order2.id,
            delay=ANY,
        )

    async def test_skips_subscription_orders(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that subscription orders are skipped"""
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
        )

        await order_service.update_product_benefits_grants(session, product)

        enqueue_job_mock.assert_not_called()

    async def test_skips_seat_based_orders(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        """Test that seat-based orders are skipped"""
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=None,
        )
        order.seats = 5
        await save_fixture(order)

        await order_service.update_product_benefits_grants(session, product)

        enqueue_job_mock.assert_not_called()

    async def test_skips_soft_deleted_customers(
        self,
        enqueue_job_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        organization: Organization,
    ) -> None:
        """Test that orders with soft-deleted customers are not processed"""
        # Create active customer with order
        active_customer = await create_customer(
            save_fixture, organization=organization, email="active@example.com"
        )
        await create_order(
            save_fixture,
            product=product,
            customer=active_customer,
            subscription=None,
        )

        # Create soft-deleted customer with order
        deleted_customer = await create_customer(
            save_fixture, organization=organization, email="deleted@example.com"
        )
        deleted_customer.set_deleted_at()
        await save_fixture(deleted_customer)
        await create_order(
            save_fixture,
            product=product,
            customer=deleted_customer,
            subscription=None,
        )

        await order_service.update_product_benefits_grants(session, product)

        # Only one job should be enqueued for the active customer
        assert enqueue_job_mock.call_count == 1
        enqueue_job_mock.assert_called_once_with(
            "benefit.enqueue_benefits_grants",
            task="grant",
            customer_id=active_customer.id,
            product_id=product.id,
            order_id=ANY,
            delay=ANY,
        )


class TestVoidOrder:
    @pytest.mark.asyncio
    async def test_void_pending_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test successfully voiding a pending order."""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )

        # When
        result_order = await order_service.void(session, order)

        # Then
        assert result_order.status == OrderStatus.void
        assert result_order.id == order.id

        events = await get_all_by_name(session, SystemEvent.order_voided)
        assert len(events) == 1
        assert events[0].user_metadata["order_id"] == str(order.id)

    @pytest.mark.asyncio
    async def test_void_order_payment_in_progress(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test that voiding an order with an active payment lock raises OrderPaymentInProgress."""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
        )
        order.payment_lock_acquired_at = utc_now()

        # When/Then
        with pytest.raises(PaymentAlreadyInProgress) as exc_info:
            await order_service.void(session, order)

        assert exc_info.value.order == order

    @pytest.mark.asyncio
    async def test_void_non_pending_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test that voiding a non-pending order raises OrderNotPending exception."""
        # Given
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
        )

        # When/Then
        with pytest.raises(OrderNotPending) as exc_info:
            await order_service.void(session, order)

        assert exc_info.value.order.id == order.id

    @pytest.mark.asyncio
    async def test_void_clears_next_payment_attempt(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test that voiding an order clears next_payment_attempt_at."""
        # Given
        next_attempt_at = utc_now() + timedelta(hours=24)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            next_payment_attempt_at=next_attempt_at,
        )

        # When
        result_order = await order_service.void(session, order)

        # Then
        assert result_order.status == OrderStatus.void
        assert result_order.next_payment_attempt_at is None

    @pytest.mark.asyncio
    async def test_void_reduces_customer_balance(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        # Given
        next_attempt_at = utc_now() + timedelta(hours=24)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subtotal_amount=800,
        )

        # Create customer balance
        await create_wallet_billing(
            save_fixture,
            customer=customer,
            initial_balance=1000,
        )

        # When
        result_order = await order_service.void(session, order)

        # Then
        assert result_order.status == OrderStatus.void

        new_balance = await wallet_service.get_billing_wallet_balance(
            session, customer, order.currency
        )
        assert new_balance == 200


@pytest.mark.asyncio
class TestVoidPendingOrdersForSubscription:
    @pytest.mark.asyncio
    async def test_void_pending_orders_for_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> None:
        """Test voiding all pending orders for a subscription."""
        # Given
        # Create a subscription
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )

        # Create two pending orders for the subscription
        next_attempt_at = utc_now() + timedelta(hours=24)
        order1 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=next_attempt_at,
        )

        order2 = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subscription=subscription,
            next_payment_attempt_at=next_attempt_at,
        )

        # When
        voided_orders = await order_service.void_pending_orders_for_subscription(
            session, subscription
        )

        # Then
        assert len(voided_orders) == 2

        # Verify both orders are voided and next_payment_attempt_at is cleared
        for order in voided_orders:
            assert order.status == OrderStatus.void
            assert order.next_payment_attempt_at is None
            assert order.subscription_id == subscription.id


@pytest_asyncio.fixture
async def off_session_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Organization:
    organization.feature_settings = {
        **organization.feature_settings,
        "off_session_charges_enabled": True,
    }
    await save_fixture(organization)
    return organization


@pytest.mark.asyncio
class TestCreateDraftOrder:
    async def test_feature_flag_disabled(
        self,
        session: AsyncSession,
        organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        # `organization` does not have the off_session_charges flag set.
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
        )
        with pytest.raises(OffSessionChargesNotEnabled):
            await order_service.create_draft_order(session, organization, payload)

    async def test_unknown_product_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        customer: Customer,
    ) -> None:
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=uuid.uuid4(),
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_recurring_product_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # The default `product` fixture is recurring monthly.
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product.id,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_seat_based_product_rejected(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=off_session_organization,
            recurring_interval=None,
            prices=[("seat", 1000, "usd")],
        )
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product.id,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_unknown_customer_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
    ) -> None:
        payload = OrderCreate(
            customer_id=uuid.uuid4(),
            product_id=product_one_time.id,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_happy_path(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )

        assert order.status == OrderStatus.draft
        assert order.invoice_number is None
        assert order.customer_id == customer.id
        assert order.product_id == product_one_time.id
        assert order.subscription_id is None
        assert order.checkout_id is None
        assert order.subtotal_amount > 0
        assert len(order.items) >= 1

    async def test_fires_order_created_webhook(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        send_webhook_mock = mocker.patch.object(order_service, "send_webhook")

        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )

        send_webhook_mock.assert_awaited_once_with(
            session, order, WebhookEventType.order_created
        )

    async def test_multi_currency_falls_back_to_org_default(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time_multiple_currencies: Product,
        customer: Customer,
    ) -> None:
        # When no currency is given, fall back to the organization's default
        # presentment currency (matching the checkout flow), even though the
        # product is priced in several currencies.
        assert off_session_organization.default_presentment_currency == "usd"
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time_multiple_currencies.id,
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        assert order.status == OrderStatus.draft
        assert order.currency == "usd"
        # The usd price set was selected (1000), not eur (900) or gbp (800).
        usd_prices = PriceSet.from_product(product_one_time_multiple_currencies, "usd")
        assert len(order.items) == len(usd_prices.prices)
        assert order.subtotal_amount == sum(
            cast(ProductPriceFixed, price).price_amount for price in usd_prices.prices
        )

    async def test_multi_currency_with_currency(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time_multiple_currencies: Product,
        customer: Customer,
    ) -> None:
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time_multiple_currencies.id,
            currency="eur",
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        assert order.status == OrderStatus.draft
        assert order.currency == "eur"
        # The eur price set was selected (900), not usd (1000) or gbp (800).
        eur_prices = PriceSet.from_product(product_one_time_multiple_currencies, "eur")
        assert len(order.items) == len(eur_prices.prices)
        assert order.subtotal_amount == sum(
            cast(ProductPriceFixed, price).price_amount for price in eur_prices.prices
        )

    async def test_unknown_currency_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
            currency="gbp",
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_custom_price_product_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time_custom_price: Product,
        customer: Customer,
    ) -> None:
        # Only fixed-price and free products are supported off-session; a
        # pay-what-you-want (custom) product is rejected.
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time_custom_price.id,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_free_product_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        customer: Customer,
    ) -> None:
        # Free products are chargeable off-session; without an amount the order
        # is a $0 draft.
        product = await create_product(
            save_fixture,
            organization=off_session_organization,
            recurring_interval=None,
            prices=[(None, "usd")],
        )
        payload = OrderCreate(customer_id=customer.id, product_id=product.id)
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        assert order.status == OrderStatus.draft
        assert order.subtotal_amount == 0

    async def test_amount_overrides_fixed_price(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        # `product_one_time` is priced at 1000 usd; the merchant charges 2500.
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
            amount=2500,
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        assert order.status == OrderStatus.draft
        assert order.subtotal_amount == 2500
        assert order.items[0].amount == 2500

    async def test_amount_on_free_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        customer: Customer,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=off_session_organization,
            recurring_interval=None,
            prices=[(None, "usd")],
        )
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product.id,
            amount=1500,
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        assert order.subtotal_amount == 1500
        assert order.items[0].amount == 1500

    async def test_custom_description_overrides_label(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
            description="5,000 tokens",
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        assert order.items[0].label == "5,000 tokens"

    async def test_positive_amount_below_currency_minimum_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        # usd's minimum is 50; a positive amount below it would be rejected at
        # finalize, so reject it up front.
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
            amount=10,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_amount_above_currency_maximum_rejected(
        self,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        customer: Customer,
    ) -> None:
        # An amount above the currency's maximum would be rejected at finalize,
        # so reject it up front.
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
            amount=get_maximum_currency_amount("usd") + 1,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_custom_field_data_validated_against_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        customer: Customer,
    ) -> None:
        text_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.text,
            slug="note",
            organization=off_session_organization,
        )
        product = await create_product(
            save_fixture,
            organization=off_session_organization,
            recurring_interval=None,
            attached_custom_fields=[(text_field, False)],
        )
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product.id,
            custom_field_data={"note": "hello", "unknown": "dropme"},
        )
        order = await order_service.create_draft_order(
            session, off_session_organization, payload
        )
        # Unknown keys are dropped; the product's field is kept.
        assert order.custom_field_data == {"note": "hello"}

    async def test_custom_field_wrong_type_rejected(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        customer: Customer,
    ) -> None:
        number_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.number,
            slug="level",
            organization=off_session_organization,
        )
        product = await create_product(
            save_fixture,
            organization=off_session_organization,
            recurring_interval=None,
            attached_custom_fields=[(number_field, False)],
        )
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product.id,
            custom_field_data={"level": "not-a-number"},
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )

    async def test_uncomputable_tax_rejected(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        off_session_organization: Organization,
        product_one_time: Product,
        tax_service_mock: MagicMock,
    ) -> None:
        # The customer has a billing address (so tax is attempted), but the
        # processor can't compute tax for it. The draft must be rejected rather
        # than persisted tax-free — finalize never recomputes it.
        tax_service_mock.calculate.side_effect = TaxCalculationLogicalError(
            "Invalid address"
        )
        customer = await create_customer(
            save_fixture,
            organization=off_session_organization,
            billing_address=Address(country=CountryAlpha2("US")),
        )
        payload = OrderCreate(
            customer_id=customer.id,
            product_id=product_one_time.id,
        )
        with pytest.raises(PolarRequestValidationError):
            await order_service.create_draft_order(
                session, off_session_organization, payload
            )


@pytest.mark.asyncio
class TestFinalizeOrder:
    async def test_order_not_draft(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.paid,
        )
        with pytest.raises(OrderNotDraft):
            await order_service.finalize_order(session, order)

    async def test_lost_draft_claim_raises(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # Another request already claimed the draft, so the atomic
        # start_finalization() guard returns False. Finalize must refuse and
        # leave the order untouched.
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
        )
        original_invoice_number = order.invoice_number
        mocker.patch(
            "polar.order.repository.OrderRepository.start_finalization",
            new=AsyncMock(return_value=False),
        )

        with pytest.raises(OrderNotDraft):
            await order_service.finalize_order(
                session, order, payment_method_id=payment_method.id
            )

        await session.refresh(order)
        assert order.status == OrderStatus.draft
        assert order.invoice_number == original_invoice_number
        assert order.payment_lock_acquired_at is None

    async def test_feature_flag_revoked_between_create_and_finalize(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        # Org has no flag set; calling finalize on a draft should refuse.
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )
        with pytest.raises(OffSessionChargesNotEnabled):
            await order_service.finalize_order(session, order)

    async def test_organization_cannot_accept_payments(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        # Flag is enabled, but the org's account can't accept payments yet
        # (e.g. pending onboarding / under review).
        off_session_organization.capabilities = {
            **off_session_organization.capabilities,
            "checkout_payments": False,
        }
        await save_fixture(off_session_organization)

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )
        with pytest.raises(OrganizationNotReadyForPayments):
            await order_service.finalize_order(session, order)

        await session.refresh(order)
        # Rejected before any state change — the order stays a draft.
        assert order.status == OrderStatus.draft

    async def test_missing_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )
        with pytest.raises(PaymentFailed):
            await order_service.finalize_order(session, order)

        await session.refresh(order)
        # Missing payment method is caught before any state mutation —
        # nothing changes on the order.
        assert order.status == OrderStatus.draft

    async def test_card_error_reverts_to_draft(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )

        stripe_service_mock.create_payment_intent.side_effect = stripe_lib.CardError(
            message="Your card was declined.",
            param="card",
            code="card_declined",
        )

        with pytest.raises(PaymentFailed):
            await order_service.finalize_order(
                session, order, payment_method_id=payment_method.id
            )

        await session.refresh(order)
        assert order.status == OrderStatus.draft
        assert order.invoice_number is None
        assert order.payment_lock_acquired_at is None

    async def test_requires_action_reverts_to_draft(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )

        stripe_service_mock.create_payment_intent.return_value = (
            build_stripe_payment_intent(status="requires_action")
        )

        with pytest.raises(PaymentActionRequired):
            await order_service.finalize_order(
                session, order, payment_method_id=payment_method.id
            )

        await session.refresh(order)
        assert order.status == OrderStatus.draft
        assert order.invoice_number is None

    async def test_explicit_payment_method_must_belong_to_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        other_payment_method = await create_payment_method(
            save_fixture, customer=customer_second
        )
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )

        with pytest.raises(PaymentFailed):
            await order_service.finalize_order(
                session, order, payment_method_id=other_payment_method.id
            )

        await session.refresh(order)
        assert order.status == OrderStatus.draft

    async def test_happy_path_charges_and_settles_inline(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )

        # A succeeded off-session charge with an expanded Charge, as
        # trigger_payment requests via expand=["latest_charge"].
        payment_intent = stripe_lib.PaymentIntent.construct_from(
            {
                "id": "pi_finalize_success",
                "status": "succeeded",
                "latest_charge": {"object": "charge", "id": "ch_finalize_success"},
            },
            None,
        )
        stripe_service_mock.create_payment_intent.return_value = payment_intent

        # The charge -> payment -> benefit-grant pipeline has its own coverage;
        # here we only assert finalize's orchestration drives it with a paid
        # order, rather than leaving settlement to the webhook.
        def _settle(_session: AsyncSession, settled: Order, _payment: object) -> Order:
            settled.status = OrderStatus.paid
            return settled

        upsert_mock = mocker.patch(
            "polar.order.service.payment_service.upsert_from_stripe_charge",
            new=AsyncMock(return_value=MagicMock()),
        )
        handle_payment_mock = mocker.patch.object(
            order_service, "handle_payment", new=AsyncMock(side_effect=_settle)
        )

        result = await order_service.finalize_order(
            session, order, payment_method_id=payment_method.id
        )

        assert result.status == OrderStatus.paid
        # The invoice number is assigned inline, and only on success.
        assert result.invoice_number is not None

        # The charge is keyed for idempotency (sync/finalize path only) so a
        # retry after a lost response can't double-charge.
        call_kwargs = stripe_service_mock.create_payment_intent.call_args[1]
        assert (
            call_kwargs["idempotency_key"]
            == f"order_finalize:{order.id}:{payment_method.processor_id}"
        )

        # The success path is applied inline: the expanded charge is extracted
        # and handed to the payment + settlement pipeline.
        upsert_mock.assert_awaited_once()
        charge_arg = upsert_mock.call_args.args[1]
        assert isinstance(charge_arg, stripe_lib.Charge)
        assert charge_arg.id == "ch_finalize_success"
        handle_payment_mock.assert_awaited_once()

    async def test_sends_confirmation_email_once_settled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        product: Product,
        customer: Customer,
        stripe_service_mock: MagicMock,
        mocker: MockerFixture,
        enqueue_job_mock: MagicMock,
    ) -> None:
        # The draft flow skips the confirmation email at creation, so finalize
        # must enqueue it once the order settles as paid.
        payment_method = await create_payment_method(save_fixture, customer=customer)
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.draft,
            invoice_number=None,
        )

        payment_intent = stripe_lib.PaymentIntent.construct_from(
            {
                "id": "pi_finalize_success",
                "status": "succeeded",
                "latest_charge": {"object": "charge", "id": "ch_finalize_success"},
            },
            None,
        )
        stripe_service_mock.create_payment_intent.return_value = payment_intent

        payment = await create_payment(
            save_fixture,
            off_session_organization,
            processor_id="ch_finalize_success",
        )
        mocker.patch(
            "polar.order.service.payment_service.upsert_from_stripe_charge",
            new=AsyncMock(return_value=payment),
        )

        result = await order_service.finalize_order(
            session, order, payment_method_id=payment_method.id
        )

        assert result.status == OrderStatus.paid
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.confirmation_email", order.id)
            )
            == 1
        )

    async def test_sends_confirmation_email_for_free_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        off_session_organization: Organization,
        customer: Customer,
        enqueue_job_mock: MagicMock,
    ) -> None:
        # A $0 (free) draft settles via the under-minimum branch of
        # trigger_payment (no Stripe charge), which still reaches the paid state.
        # The confirmation email must be enqueued on that path too.
        product = await create_product(
            save_fixture,
            organization=off_session_organization,
            recurring_interval=None,
            prices=[(None, "usd")],
        )
        order = await order_service.create_draft_order(
            session,
            off_session_organization,
            OrderCreate(customer_id=customer.id, product_id=product.id),
        )
        assert order.status == OrderStatus.draft
        assert order.due_amount == 0

        payment_method = await create_payment_method(save_fixture, customer=customer)

        result = await order_service.finalize_order(
            session, order, payment_method_id=payment_method.id
        )

        assert result.status == OrderStatus.paid
        assert (
            enqueue_job_mock.call_args_list.count(
                call("order.confirmation_email", order.id)
            )
            == 1
        )
