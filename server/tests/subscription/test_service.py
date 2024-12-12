from datetime import UTC, datetime, timedelta
from typing import cast
from unittest.mock import MagicMock, call

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.authz.service import Authz
from polar.checkout.eventstream import CheckoutEvent
from polar.customer.service import customer as customer_service
from polar.kit.pagination import PaginationParams
from polar.models import (
    Benefit,
    Customer,
    Discount,
    Organization,
    Product,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.subscription.service import (
    AssociatedSubscriptionTierPriceDoesNotExist,
    SubscriptionDoesNotExist,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.email import WatcherEmailSender, watch_email
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_subscription,
    set_product_benefits,
)


def construct_stripe_subscription(
    *,
    customer: Customer | None = None,
    organization: Organization | None = None,
    price_id: str = "PRICE_ID",
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    latest_invoice: stripe_lib.Invoice | None = None,
    cancel_at_period_end: bool = False,
    metadata: dict[str, str] = {},
    discount: Discount | None = None,
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    base_metadata: dict[str, str] = {
        **(
            {"organization_subscriber_id": str(organization.id)}
            if organization is not None
            else {}
        ),
    }
    return stripe_lib.Subscription.construct_from(
        {
            "id": "SUBSCRIPTION_ID",
            "customer": customer.stripe_customer_id
            if customer is not None
            else "CUSTOMER_ID",
            "status": status,
            "items": {
                "data": [
                    {"price": {"id": price_id, "currency": "USD", "unit_amount": 1000}}
                ]
            },
            "current_period_start": now_timestamp,
            "current_period_end": now_timestamp + timedelta(days=30).seconds,
            "cancel_at_period_end": cancel_at_period_end,
            "ended_at": None,
            "latest_invoice": latest_invoice,
            "metadata": {**base_metadata, **metadata},
            "discount": {
                "coupon": {
                    "id": discount.stripe_coupon_id,
                    "metadata": {"discount_id": str(discount.id)},
                }
            }
            if discount is not None
            else None,
        },
        None,
    )


def construct_stripe_customer(
    *,
    id: str = "CUSTOMER_ID",
    email: str = "customer@example.com",
    name: str | None = "Customer Name",
) -> stripe_lib.Customer:
    return stripe_lib.Customer.construct_from(
        {
            "id": id,
            "email": email,
            "name": name,
            "address": {
                "country": "FR",
            },
        },
        None,
    )


def construct_stripe_invoice(
    *,
    id: str = "INVOICE_ID",
    total: int = 12000,
    tax: int = 2000,
    charge_id: str = "CHARGE_ID",
    subscription_id: str = "SUBSCRIPTION_ID",
    metadata: dict[str, str] = {},
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": id,
            "total": total,
            "tax": tax,
            "currency": "usd",
            "charge": charge_id,
            "subscription": subscription_id,
            "metadata": metadata,
        },
        None,
    )


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestCreateArbitrarySubscription:
    async def test_valid_fixed_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        # then
        session.expunge_all()

        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)
        subscription = await subscription_service.create_arbitrary_subscription(
            session, customer=customer, product=product, price=price
        )

        assert subscription.product_id == product.id
        assert subscription.customer == customer
        assert subscription.amount == price.price_amount
        assert subscription.currency == price.price_currency
        assert subscription.recurring_interval == price.recurring_interval

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_custom_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        product_recurring_custom_price: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        # then
        session.expunge_all()

        price = product_recurring_custom_price.prices[0]
        assert isinstance(price, ProductPriceCustom)
        subscription = await subscription_service.create_arbitrary_subscription(
            session,
            customer=customer,
            product=product_recurring_custom_price,
            price=price,
            amount=2000,
        )

        assert subscription.product_id == product_recurring_custom_price.id
        assert subscription.customer == customer
        assert subscription.amount == 2000
        assert subscription.currency == price.price_currency
        assert subscription.recurring_interval == price.recurring_interval

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_free_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        product_recurring_free_price: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        # then
        session.expunge_all()

        price = product_recurring_free_price.prices[0]
        assert isinstance(price, ProductPriceFree)
        subscription = await subscription_service.create_arbitrary_subscription(
            session,
            customer=customer,
            product=product_recurring_free_price,
            price=price,
        )

        assert subscription.product_id == product_recurring_free_price.id
        assert subscription.customer == customer
        assert subscription.amount is None
        assert subscription.currency is None
        assert subscription.recurring_interval == price.recurring_interval

        enqueue_benefits_grants_mock.assert_called_once()


@pytest.mark.asyncio
class TestCreateSubscriptionFromStripe:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()

        # then
        session.expunge_all()

        with pytest.raises(AssociatedSubscriptionTierPriceDoesNotExist):
            await subscription_service.create_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_new_customer(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        stripe_subscription = construct_stripe_subscription(
            price_id=product.prices[0].stripe_price_id
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product.id

        customer = await customer_service.get_by_stripe_customer_id(
            session, stripe_customer.id
        )
        assert customer is not None
        assert customer.email == stripe_customer.email
        assert customer.stripe_customer_id == stripe_subscription.customer

    async def test_existing_customer(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        stripe_customer = construct_stripe_customer(
            id=cast(str, customer.stripe_customer_id)
        )
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        stripe_subscription = construct_stripe_subscription(
            customer=customer, price_id=product.prices[0].stripe_price_id
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product.id

        assert subscription.customer == customer

    async def test_set_started_at(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        stripe_subscription = construct_stripe_subscription(
            customer=customer,
            price_id=product.prices[0].stripe_price_id,
            status=SubscriptionStatus.active,
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.started_at is not None

    async def test_free_price(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product_recurring_free_price: Product,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert product_recurring_free_price.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            price_id=product_recurring_free_price.prices[0].stripe_price_id
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product_recurring_free_price.id
        assert subscription.amount is None
        assert subscription.currency is None

    async def test_subscription_update(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        product_recurring_free_price: Product,
        product: Product,
        customer: Customer,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        existing_subscription = await create_active_subscription(
            save_fixture, product=product_recurring_free_price, customer=customer
        )

        price = product.prices[0]
        stripe_subscription = construct_stripe_subscription(
            customer=customer,
            price_id=price.stripe_price_id,
            status=SubscriptionStatus.active,
            metadata={"subscription_id": str(existing_subscription.id)},
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.id == existing_subscription.id
        assert subscription.started_at == existing_subscription.started_at
        assert subscription.price == price
        assert subscription.product == product

    async def test_discount(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
        discount_fixed_once: Discount,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        stripe_subscription = construct_stripe_subscription(
            price_id=product.prices[0].stripe_price_id, discount=discount_fixed_once
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.discount == discount_fixed_once

    async def test_checkout(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        product: Product,
    ) -> None:
        publish_checkout_event_mock = mocker.patch(
            "polar.subscription.service.publish_checkout_event"
        )

        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        price = product.prices[0]
        checkout = await create_checkout(
            save_fixture, price=price, status=CheckoutStatus.succeeded
        )
        stripe_subscription = construct_stripe_subscription(
            price_id=price.stripe_price_id, metadata={"checkout_id": str(checkout.id)}
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.checkout == checkout
        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret, CheckoutEvent.subscription_created
        )


@pytest.mark.asyncio
class TestUpdateSubscriptionFromStripe:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()

        # then
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_not_existing_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active, price_id="NOT_EXISTING_PRICE_ID"
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        # then
        session.expunge_all()

        with pytest.raises(AssociatedSubscriptionTierPriceDoesNotExist):
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        price = product.prices[0]
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active, price_id=price.stripe_price_id
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.started_at is not None

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_cancel_at_period_end(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        price = product.prices[0]
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active,
            price_id=price.stripe_price_id,
            cancel_at_period_end=True,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_new_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_recurring_free_price: Product,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        free_price = product_recurring_free_price.prices[0]
        paid_price = product.prices[0]

        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active, price_id=paid_price.stripe_price_id
        )
        subscription = await create_subscription(
            save_fixture,
            product=product_recurring_free_price,
            price=free_price,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.started_at is not None
        assert updated_subscription.price == paid_price
        assert updated_subscription.product == product

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        discount_fixed_once: Discount,
    ) -> None:
        price = product.prices[0]
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active,
            price_id=price.stripe_price_id,
            discount=discount_fixed_once,
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.discount is None

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.discount == discount_fixed_once


@pytest.mark.asyncio
class TestEnqueueBenefitsGrants:
    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.incomplete, SubscriptionStatus.incomplete_expired]
    )
    async def test_incomplete_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_not_called()

    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.trialing, SubscriptionStatus.active]
    )
    async def test_active_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.enqueue_benefits_grants",
                    task="grant",
                    customer_id=subscription.customer_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
            ]
        )

    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.past_due,
            SubscriptionStatus.canceled,
            SubscriptionStatus.unpaid,
        ],
    )
    async def test_canceled_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    customer_id=subscription.customer_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
            ]
        )


@pytest.mark.asyncio
class TestUpdateProductBenefitsGrants:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        product: Product,
        product_second: Product,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        subscription_1 = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription_2 = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        await create_subscription(
            save_fixture,
            product=product_second,
            customer=customer,
        )

        # then
        session.expunge_all()

        await subscription_service.update_product_benefits_grants(session, product)

        assert enqueue_benefits_grants_mock.call_count == 2
        assert enqueue_benefits_grants_mock.call_args_list[0].args[1] == subscription_1
        assert enqueue_benefits_grants_mock.call_args_list[1].args[1] == subscription_2


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 0
        assert count == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
@pytest.mark.email_subscription_confirmation
async def test_send_confirmation_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
) -> None:
    with WatcherEmailSender() as email_sender:
        mocker.patch(
            "polar.subscription.service.get_email_sender", return_value=email_sender
        )

        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        async def _send_confirmation_email() -> None:
            await subscription_service.send_confirmation_email(session, subscription)

        await watch_email(_send_confirmation_email, email_sender.path)
