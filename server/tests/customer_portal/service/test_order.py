from uuid import uuid4

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.customer_portal.schemas.order import (
    CustomerOrderPayConfirmationToken,
    CustomerOrderPayPaymentMethod,
    CustomerOrderPayWithoutCredentials,
)
from polar.customer_portal.service.order import (
    CustomerOrderSortProperty,
    OrderNotEligibleForRetry,
)
from polar.customer_portal.service.order import customer_order as customer_order_service
from polar.enums import PaymentProcessor
from polar.exceptions import PolarRequestValidationError
from polar.kit.address import AddressInput
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, Order, Organization, Product
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.service import PaymentError
from polar.order.service import order as order_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_product,
    create_subscription,
)


@pytest.mark.anyio
class TestPay:
    @pytest.fixture
    async def draft_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
    ) -> Order:
        product.is_tax_applicable = False
        customer.stripe_customer_id = "cus_test"
        subscription = await create_subscription(
            save_fixture,
            customer=customer,
            product=product,
            status=SubscriptionStatus.trial_ended,
        )
        return await order_service.create_subscription_reactivation_order(
            session, subscription
        )

    async def test_updates_billing_and_submits_saved_payment_method(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(
            save_fixture, customer=customer, status=OrderStatus.pending
        )
        submit = mocker.patch(
            "polar.order.service.OrderService.handle_on_session_payment",
            return_value=order,
        )
        payment_method_id = uuid4()
        order_pay = CustomerOrderPayPaymentMethod(
            billing_name="Updated billing name",
            billing_address=AddressInput.model_validate({"country": "FR"}),
            payment_method_id=payment_method_id,
        )

        result = await customer_order_service.pay(session, order, order_pay)

        assert result.billing_name == "Updated billing name"
        await session.flush()
        await session.refresh(customer)
        assert customer.billing_name == "Updated billing name"
        assert customer.billing_address == result.billing_address
        submit.assert_awaited_once_with(
            session,
            order,
            payment_method_id=payment_method_id,
            intent_type="payment",
        )

    async def test_updates_billing_and_submits_confirmation_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(
            save_fixture, customer=customer, status=OrderStatus.pending
        )
        submit = mocker.patch(
            "polar.order.service.OrderService.handle_on_session_payment",
            return_value=order,
        )
        order_pay = CustomerOrderPayConfirmationToken(
            billing_name="Updated billing name",
            billing_address=AddressInput.model_validate({"country": "FR"}),
            payment_processor=PaymentProcessor.stripe,
            confirmation_token_id="ctoken_test",
        )

        result = await customer_order_service.pay(session, order, order_pay)

        assert result.billing_name == "Updated billing name"
        submit.assert_awaited_once_with(
            session,
            order,
            confirmation_token_id="ctoken_test",
            payment_processor=PaymentProcessor.stripe,
            intent_type="payment",
        )

    async def test_saves_customer_billing_when_draft_payment_requires_action(
        self, session: AsyncSession, draft_order: Order, mocker: MockerFixture
    ) -> None:
        customer = draft_order.customer
        customer.stripe_customer_id = None
        create_stripe_customer = mocker.patch(
            "polar.order.service.stripe_service.create_customer",
            return_value=stripe_lib.Customer.construct_from({"id": "cus_new"}, None),
        )
        submit = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            return_value=stripe_lib.PaymentIntent.construct_from(
                {
                    "id": "pi_test",
                    "status": "requires_action",
                    "client_secret": "pi_test_secret",
                },
                None,
            ),
        )
        order_pay = CustomerOrderPayConfirmationToken(
            billing_name="Updated billing name",
            billing_address=AddressInput.model_validate({"country": "FR"}),
            tax_id="FR61954506077",
            payment_processor=PaymentProcessor.stripe,
            confirmation_token_id="ctoken_test",
        )

        result = await customer_order_service.pay(session, draft_order, order_pay)

        create_stripe_customer.assert_awaited_once()
        submit.assert_awaited_once()
        assert submit.call_args.kwargs["customer"] == "cus_new"
        await session.flush()
        await session.refresh(customer)
        assert customer.stripe_customer_id == "cus_new"
        assert customer.billing_name == "Updated billing name"
        assert customer.billing_address == result.billing_address
        assert customer.tax_id == ("FR61954506077", "eu_vat")
        assert result.status == OrderStatus.pending
        assert result.next_payment_attempt_at is None
        assert result.payment_processor_metadata["intent_status"] == "requires_action"
        assert result.invoice_number is None
        assert result.subscription is not None
        assert result.subscription.status == SubscriptionStatus.trial_ended

    async def test_declined_payment_rolls_back_to_draft(
        self, session: AsyncSession, draft_order: Order, mocker: MockerFixture
    ) -> None:
        customer = draft_order.customer
        original_billing_name = draft_order.billing_name
        submit = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent",
            side_effect=stripe_lib.CardError(
                "Your card was declined.", None, "card_declined"
            ),
        )
        order_pay = CustomerOrderPayConfirmationToken(
            billing_name="Updated billing name",
            billing_address=AddressInput.model_validate({"country": "FR"}),
            payment_processor=PaymentProcessor.stripe,
            confirmation_token_id="ctoken_test",
        )

        with pytest.raises(PaymentError):
            async with session.begin_nested():
                await customer_order_service.pay(session, draft_order, order_pay)

        submit.assert_awaited_once()
        await session.refresh(draft_order)
        await session.refresh(customer)
        assert draft_order.status == OrderStatus.draft
        assert draft_order.billing_name == original_billing_name
        assert draft_order.payment_processor_metadata == {}
        assert customer.billing_name == original_billing_name

    @pytest.mark.parametrize("status", [OrderStatus.paid, OrderStatus.void])
    async def test_rejects_closed_order(
        self,
        session: AsyncSession,
        draft_order: Order,
        status: OrderStatus,
        mocker: MockerFixture,
    ) -> None:
        draft_order.status = status
        submit = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent"
        )
        order_pay = CustomerOrderPayConfirmationToken(
            billing_address=AddressInput.model_validate({"country": "FR"}),
            payment_processor=PaymentProcessor.stripe,
            confirmation_token_id="ctoken_test",
        )

        with pytest.raises(OrderNotEligibleForRetry):
            await customer_order_service.pay(session, draft_order, order_pay)

        assert draft_order.status == status
        submit.assert_not_awaited()

    async def test_rejects_stale_trial_draft(
        self, session: AsyncSession, draft_order: Order, mocker: MockerFixture
    ) -> None:
        assert draft_order.subscription is not None
        draft_order.subscription.status = SubscriptionStatus.active
        submit = mocker.patch(
            "polar.order.service.stripe_service.create_payment_intent"
        )
        order_pay = CustomerOrderPayConfirmationToken(
            billing_address=AddressInput.model_validate({"country": "FR"}),
            payment_processor=PaymentProcessor.stripe,
            confirmation_token_id="ctoken_test",
        )

        with pytest.raises(OrderNotEligibleForRetry):
            await customer_order_service.pay(session, draft_order, order_pay)

        assert draft_order.status == OrderStatus.draft
        submit.assert_not_awaited()

    async def test_taxable_draft_requires_billing_address(
        self, session: AsyncSession, draft_order: Order, mocker: MockerFixture
    ) -> None:
        assert draft_order.product is not None
        draft_order.product.is_tax_applicable = True
        draft_order.billing_address = None
        submit = mocker.patch(
            "polar.order.service.OrderService.handle_on_session_payment"
        )

        with pytest.raises(PolarRequestValidationError):
            await customer_order_service.pay(
                session,
                draft_order,
                CustomerOrderPayConfirmationToken(
                    payment_processor=PaymentProcessor.stripe,
                    confirmation_token_id="ctoken_test",
                ),
            )

        submit.assert_not_awaited()

    async def test_payment_required_without_credentials(
        self, session: AsyncSession, draft_order: Order, mocker: MockerFixture
    ) -> None:
        submit = mocker.patch(
            "polar.order.service.OrderService.handle_on_session_payment"
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await customer_order_service.pay(
                session,
                draft_order,
                CustomerOrderPayWithoutCredentials(
                    billing_address=AddressInput.model_validate({"country": "FR"}),
                ),
            )

        assert (
            exc_info.value.errors()[0]["msg"]
            == "A payment method or confirmation token is required."
        )
        assert draft_order.status == OrderStatus.draft
        submit.assert_not_awaited()


@pytest.mark.anyio
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer_second: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer_second)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1

    @pytest.mark.parametrize(
        "sorting",
        [
            [("created_at", True)],
            [("amount", True)],
            [("organization", False)],
            [("product", False)],
            [("subscription", False)],
        ],
    )
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_sorting(
        self,
        sorting: list[Sorting[CustomerOrderSortProperty]],
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(orders) == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_filters_by_product_name(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product_match = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Premium Subscription",
        )
        product_no_match = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Basic Plan",
        )
        await create_order(save_fixture, product=product_match, customer=customer)
        await create_order(save_fixture, product=product_no_match, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, query="Premium", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].product is not None
        assert orders[0].product.name == "Premium Subscription"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_percent_character(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that % in query is treated as literal, not wildcard."""
        product_with_percent = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="50% Off Deal",
        )
        product_without_percent = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Half Price Deal",
        )
        await create_order(
            save_fixture, product=product_with_percent, customer=customer
        )
        await create_order(
            save_fixture, product=product_without_percent, customer=customer
        )

        orders, count = await customer_order_service.list(
            session, auth_subject, query="50%", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert orders[0].product is not None
        assert orders[0].product.name == "50% Off Deal"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_underscore_character(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that _ in query is treated as literal, not single-char wildcard."""
        product_with_underscore = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Pro_Plan",
        )
        product_without_underscore = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="ProXPlan",
        )
        await create_order(
            save_fixture, product=product_with_underscore, customer=customer
        )
        await create_order(
            save_fixture, product=product_without_underscore, customer=customer
        )

        orders, count = await customer_order_service.list(
            session, auth_subject, query="Pro_Plan", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert orders[0].product is not None
        assert orders[0].product.name == "Pro_Plan"


@pytest.mark.anyio
class TestGetById:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture, product=product, customer=customer_second
        )

        result = await customer_order_service.get_by_id(session, auth_subject, order.id)
        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)

        result = await customer_order_service.get_by_id(session, auth_subject, order.id)

        assert result is not None
        assert result.id == order.id
