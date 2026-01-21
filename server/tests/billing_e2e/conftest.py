"""
Fixtures for billing E2E tests.

These fixtures provide:
- Stateful fakes for Stripe and Tax services
- Test data factories for billing scenarios
- Time manipulation utilities
- Task execution tracking
"""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address
from polar.kit.utils import utc_now
from polar.meter.aggregation import CountAggregation, SumAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import (
    Account,
    Benefit,
    Customer,
    Meter,
    Organization,
    PaymentMethod,
    Product,
    ProductBenefit,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from tests.billing_e2e.fakes.stripe_fake import (
    StripeStatefulFake,
    create_stripe_mock_from_fake,
)
from tests.billing_e2e.fakes.tax_fake import TaxStatefulFake
from polar.auth.models import Anonymous, AuthSubject
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_benefit,
    create_customer,
    create_meter,
    create_organization,
    create_payment_method,
    create_product,
    create_product_price_metered_unit,
    create_user,
)


# =============================================================================
# Auth Subject Helper
# =============================================================================


class AuthSubjectFixture:
    """
    Helper class for creating auth subjects in E2E tests.

    Unlike the standard auth_subject fixture which uses parametrization,
    this provides direct methods to create auth subjects for different scenarios.
    """

    def anonymous(self) -> AuthSubject[Anonymous]:
        """Create an anonymous auth subject."""
        from polar.auth.scope import Scope

        return AuthSubject(Anonymous(), {Scope.web_read, Scope.web_write}, None)

    def for_user(self, user: User) -> AuthSubject[User]:
        """Create an auth subject for a specific user."""
        from polar.auth.scope import Scope

        return AuthSubject(user, {Scope.web_read, Scope.web_write}, None)

    def for_customer(self, customer: Customer) -> AuthSubject[Customer]:
        """Create an auth subject for a specific customer."""
        from polar.auth.scope import Scope

        return AuthSubject(
            customer, {Scope.customer_portal_read, Scope.customer_portal_write}, None
        )


@pytest.fixture
def auth_subject() -> AuthSubjectFixture:
    """Auth subject helper for E2E tests."""
    return AuthSubjectFixture()


# =============================================================================
# Stateful Fakes
# =============================================================================


@pytest.fixture
def stripe_fake() -> StripeStatefulFake:
    """Stateful Stripe fake for tracking all Stripe operations."""
    return StripeStatefulFake()


@pytest.fixture
def tax_fake() -> TaxStatefulFake:
    """Stateful Tax fake for deterministic tax calculations."""
    return TaxStatefulFake(tax_rate=0.10)  # 10% tax by default


# =============================================================================
# Service Mocking
# =============================================================================


@pytest.fixture(autouse=True)
def mock_stripe_service(
    mocker: MockerFixture, stripe_fake: StripeStatefulFake
) -> MagicMock:
    """
    Mock stripe_service in all modules that use it.

    This patches the stripe service in all billing-related modules
    to use our stateful fake.
    """
    mock = create_stripe_mock_from_fake(stripe_fake)

    # Patch all modules that import stripe_service
    modules_to_patch = [
        "polar.checkout.service",
        "polar.order.service",
        "polar.subscription.service",
        "polar.payment_method.service",
        "polar.refund.service",
        "polar.customer_portal.service.customer",
        "polar.transaction.service.payment",
        "polar.transaction.service.refund",
        "polar.integrations.stripe.tasks",
    ]

    for module in modules_to_patch:
        mocker.patch(f"{module}.stripe_service", new=mock)

    return mock


@pytest.fixture(autouse=True)
def mock_tax_service(mocker: MockerFixture, tax_fake: TaxStatefulFake) -> MagicMock:
    """
    Mock the tax service to use our stateful fake.
    """
    mock = MagicMock()
    mock.calculate = AsyncMock(side_effect=tax_fake.calculate)
    mock.record = AsyncMock(side_effect=tax_fake.record)
    mock.revert = AsyncMock(side_effect=tax_fake.revert)

    mocker.patch("polar.order.service.get_tax_service", return_value=mock)
    mocker.patch("polar.checkout.service.get_tax_service", return_value=mock)

    return mock


@pytest.fixture
def enqueue_job_tracker(mocker: MockerFixture) -> MagicMock:
    """
    Track all enqueue_job calls without actually enqueueing.

    Use this to verify which background jobs would be triggered.
    """
    mock = mocker.patch("polar.worker.enqueue_job")
    return mock


@pytest.fixture(autouse=True)
def mock_email(mocker: MockerFixture) -> MagicMock:
    """Mock email sending."""
    return mocker.patch("polar.email.sender.enqueue_email")


# =============================================================================
# Test Data Factories
# =============================================================================


@pytest_asyncio.fixture
async def billing_organization(save_fixture: SaveFixture) -> Organization:
    """Organization configured for billing tests."""
    return await create_organization(
        save_fixture,
        name_prefix="billing_test_org",
        default_presentment_currency="usd",
    )


@pytest_asyncio.fixture
async def billing_user(
    save_fixture: SaveFixture, billing_organization: Organization
) -> User:
    """User with organization membership for billing tests."""
    user = await create_user(save_fixture)
    user_org = UserOrganization(user=user, organization=billing_organization)
    await save_fixture(user_org)
    return user


@pytest_asyncio.fixture
async def billing_account(
    save_fixture: SaveFixture,
    billing_organization: Organization,
    billing_user: User,
) -> Account:
    """Stripe account for the organization."""
    return await create_account(
        save_fixture,
        billing_organization,
        billing_user,
        status=Account.Status.ACTIVE,
    )


@pytest_asyncio.fixture
async def billing_customer(
    save_fixture: SaveFixture, billing_organization: Organization
) -> Customer:
    """Customer for billing tests with Stripe customer ID."""
    return await create_customer(
        save_fixture,
        organization=billing_organization,
        stripe_customer_id="cus_test_billing_customer",
        email="billing_test@example.com",
        billing_address=Address(
            country="US",
            line1="123 Test St",
            city="Test City",
            state="CA",
            postal_code="12345",
        ),
    )


@pytest_asyncio.fixture
async def billing_payment_method(
    save_fixture: SaveFixture, billing_customer: Customer
) -> PaymentMethod:
    """Payment method for the billing customer."""
    return await create_payment_method(
        save_fixture,
        customer=billing_customer,
        stripe_payment_method_id="pm_test_billing",
    )


@pytest_asyncio.fixture
async def api_calls_meter(
    save_fixture: SaveFixture, billing_organization: Organization
) -> Meter:
    """Meter for tracking API calls (count aggregation)."""
    return await create_meter(
        save_fixture,
        organization=billing_organization,
        name="API Calls",
        filter=Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="name", operator=FilterOperator.eq, value="api_call"
                )
            ],
        ),
        aggregation=CountAggregation(),
    )


@pytest_asyncio.fixture
async def data_transfer_meter(
    save_fixture: SaveFixture, billing_organization: Organization
) -> Meter:
    """Meter for tracking data transfer (sum aggregation on bytes)."""
    return await create_meter(
        save_fixture,
        organization=billing_organization,
        name="Data Transfer",
        filter=Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="name", operator=FilterOperator.eq, value="data_transfer"
                )
            ],
        ),
        aggregation=SumAggregation(property="bytes"),
    )


# =============================================================================
# Product Factories
# =============================================================================


@pytest_asyncio.fixture
async def fixed_price_product(
    save_fixture: SaveFixture, billing_organization: Organization
) -> Product:
    """Simple monthly subscription product with fixed price."""
    return await create_product(
        save_fixture,
        organization=billing_organization,
        name="Pro Plan",
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(9900, "usd")],  # $99/month
    )


@pytest_asyncio.fixture
async def metered_product(
    save_fixture: SaveFixture,
    billing_organization: Organization,
    api_calls_meter: Meter,
) -> Product:
    """Product with metered pricing based on API calls."""
    product = await create_product(
        save_fixture,
        organization=billing_organization,
        name="Usage Plan",
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[],  # We'll add metered price separately
    )

    # Add metered price: $0.01 per API call
    metered_price = await create_product_price_metered_unit(
        save_fixture,
        product=product,
        meter=api_calls_meter,
        unit_amount=Decimal("1"),  # 1 cent per unit
        currency="usd",
    )
    product.prices.append(metered_price)
    product.all_prices.append(metered_price)

    return product


@pytest_asyncio.fixture
async def hybrid_product(
    save_fixture: SaveFixture,
    billing_organization: Organization,
    api_calls_meter: Meter,
) -> Product:
    """Product with both fixed base price and metered usage."""
    product = await create_product(
        save_fixture,
        organization=billing_organization,
        name="Hybrid Plan",
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(4900, "usd")],  # $49/month base
    )

    # Add metered price: $0.005 per API call
    metered_price = await create_product_price_metered_unit(
        save_fixture,
        product=product,
        meter=api_calls_meter,
        unit_amount=Decimal("0.5"),  # 0.5 cents per unit
        currency="usd",
    )
    product.prices.append(metered_price)
    product.all_prices.append(metered_price)

    return product


# =============================================================================
# Benefit Factories
# =============================================================================


@pytest_asyncio.fixture
async def meter_credit_benefit(
    save_fixture: SaveFixture,
    billing_organization: Organization,
    api_calls_meter: Meter,
) -> Benefit:
    """Benefit that grants meter credits (included API calls)."""
    benefit = await create_benefit(
        save_fixture,
        organization=billing_organization,
        type=BenefitType.meter_credit,
        description="1000 included API calls",
        properties={
            "meter_id": str(api_calls_meter.id),
            "units": 1000,
        },
    )
    return benefit


async def attach_benefit_to_product(
    save_fixture: SaveFixture,
    product: Product,
    benefit: Benefit,
) -> Product:
    """Attach a benefit to a product."""
    product.product_benefits.append(ProductBenefit(benefit=benefit, order=0))
    await save_fixture(product)
    return product


# =============================================================================
# Time Utilities
# =============================================================================


class TimeController:
    """
    Controller for manipulating time in tests.

    Usage:
        time_ctrl = TimeController()
        with time_ctrl.freeze_at(datetime(2024, 1, 1)):
            # Time is frozen at Jan 1, 2024
            ...

        # Or advance time
        time_ctrl.advance_days(30)
    """

    def __init__(self) -> None:
        self._current_time: datetime | None = None
        self._patches: list[Any] = []

    @property
    def now(self) -> datetime:
        """Get the current time (frozen or real)."""
        if self._current_time:
            return self._current_time
        return utc_now()

    def set_time(self, dt: datetime) -> None:
        """Set the current time."""
        self._current_time = dt

    def advance_days(self, days: int) -> datetime:
        """Advance time by the specified number of days."""
        if self._current_time is None:
            self._current_time = utc_now()
        self._current_time = self._current_time + timedelta(days=days)
        return self._current_time

    def advance_to_end_of_month(self) -> datetime:
        """Advance to the end of the current month."""
        if self._current_time is None:
            self._current_time = utc_now()

        # Move to first of next month, then back one day
        if self._current_time.month == 12:
            next_month = self._current_time.replace(
                year=self._current_time.year + 1, month=1, day=1
            )
        else:
            next_month = self._current_time.replace(
                month=self._current_time.month + 1, day=1
            )
        self._current_time = next_month - timedelta(days=1)
        return self._current_time


@pytest.fixture
def time_controller() -> TimeController:
    """Time controller for manipulating time in tests."""
    return TimeController()


# =============================================================================
# Assertion Helpers
# =============================================================================


class BillingAssertions:
    """Helper class for billing-related assertions."""

    def __init__(
        self,
        stripe_fake: StripeStatefulFake,
        tax_fake: TaxStatefulFake,
        enqueue_job_tracker: MagicMock,
    ):
        self.stripe = stripe_fake
        self.tax = tax_fake
        self.jobs = enqueue_job_tracker

    def assert_payment_succeeded(self, amount: int) -> None:
        """Assert a payment was processed successfully."""
        pi = self.stripe.assert_payment_intent_created(amount=amount)
        assert pi.status == "succeeded", f"Payment intent status was {pi.status}"

    def assert_no_payment(self) -> None:
        """Assert no payment was processed."""
        assert len(self.stripe.payment_intents) == 0, "Expected no payment intents"

    def assert_tax_calculated(self, amount: int) -> None:
        """Assert tax was calculated for the given amount."""
        self.tax.assert_tax_for_amount(amount)

    def assert_job_enqueued(self, job_name: str) -> None:
        """Assert a background job was enqueued."""
        calls = self.jobs.call_args_list
        job_names = [call[0][0] for call in calls]
        assert job_name in job_names, f"Job {job_name} was not enqueued. Jobs: {job_names}"

    def get_total_charged(self) -> int:
        """Get the total amount charged."""
        return self.stripe.get_total_charged_amount()


@pytest.fixture
def billing_assertions(
    stripe_fake: StripeStatefulFake,
    tax_fake: TaxStatefulFake,
    enqueue_job_tracker: MagicMock,
) -> BillingAssertions:
    """Helper for billing-related assertions."""
    return BillingAssertions(stripe_fake, tax_fake, enqueue_job_tracker)
