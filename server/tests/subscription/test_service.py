from collections import namedtuple
from datetime import datetime
from typing import cast
from unittest.mock import MagicMock, call

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.checkout.eventstream import CheckoutEvent
from polar.customer.service import customer as customer_service
from polar.exceptions import BadRequest, ResourceUnavailable
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
    AlreadyCanceledSubscription,
    AssociatedSubscriptionTierPriceDoesNotExist,
    SubscriptionDoesNotExist,
)
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.email import WatcherEmailRenderer, watch_email
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_canceled_subscription,
    create_checkout,
    create_subscription,
    set_product_benefits,
)
from tests.fixtures.stripe import (
    cloned_stripe_canceled_subscription,
    cloned_stripe_subscription,
    construct_stripe_customer,
    construct_stripe_subscription,
)

Hooks = namedtuple("Hooks", "updated activated canceled uncanceled revoked")
HookNames = frozenset(Hooks._fields)


@pytest.fixture
def subscription_hooks(mocker: MockerFixture) -> Hooks:
    updated = mocker.patch.object(subscription_service, "_on_subscription_updated")
    activated = mocker.patch.object(subscription_service, "_on_subscription_activated")
    canceled = mocker.patch.object(subscription_service, "_on_subscription_canceled")
    uncanceled = mocker.patch.object(
        subscription_service, "_on_subscription_uncanceled"
    )
    revoked = mocker.patch.object(subscription_service, "_on_subscription_revoked")
    return Hooks(
        updated=updated,
        activated=activated,
        canceled=canceled,
        uncanceled=uncanceled,
        revoked=revoked,
    )


def assert_hooks_called_once(subscription_hooks: Hooks, called: set[str]) -> None:
    for hook in called:
        getattr(subscription_hooks, hook).assert_called_once()

    not_called = HookNames - called
    for hook in not_called:
        getattr(subscription_hooks, hook).assert_not_called()


def reset_hooks(subscription_hooks: Hooks) -> None:
    for hook in HookNames:
        getattr(subscription_hooks, hook).reset_mock()


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
        subscription_hooks: Hooks,
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
        subscription_hooks: Hooks,
        product: Product,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        stripe_subscription = construct_stripe_subscription(
            price_id=product.prices[0].stripe_price_id,
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product.id

        customer = await customer_service.get_by_stripe_customer_id_and_organization(
            session, stripe_customer.id, product.organization
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
        subscription_hooks: Hooks,
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

        subscription = await subscription_service.update_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.id == existing_subscription.id
        assert subscription.started_at == existing_subscription.started_at
        assert subscription.price == price
        assert subscription.product == product
        assert_hooks_called_once(subscription_hooks, {"updated"})

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
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )
        price = product.prices[0]
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(subscription)

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
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})

    async def test_uncancel_active(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        price = product.prices[0]
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is False

        with pytest.raises(BadRequest):
            await subscription_service.uncancel(session, subscription)

    async def test_repeat_cancel_raises(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        price = product.prices[0]
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is True

        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.cancel(session, subscription)

    async def test_send_cancel_hooks_once(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        price = product.prices[0]
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is False
        stripe_subscription = cloned_stripe_subscription(
            subscription, cancel_at_period_end=True
        )

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True
        assert updated_subscription.ends_at
        assert updated_subscription.canceled_at
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})
        reset_hooks(subscription_hooks)

        repeat_cancellation = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )
        assert repeat_cancellation.status == SubscriptionStatus.active
        assert repeat_cancellation.cancel_at_period_end is True
        assert repeat_cancellation.ends_at
        assert repeat_cancellation.canceled_at
        assert_hooks_called_once(subscription_hooks, {"updated"})

    async def test_uncancel_already_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        price = product.prices[0]
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
            cancel_at_period_end=False,
            revoke=True,
        )
        assert subscription.cancel_at_period_end is False
        assert subscription.ended_at
        assert subscription.canceled_at

        with pytest.raises(ResourceUnavailable):
            await subscription_service.uncancel(session, subscription)

    async def test_valid_uncancel(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        price = product.prices[0]
        subscription = await create_canceled_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        assert subscription.cancel_at_period_end is True
        assert subscription.ends_at
        assert subscription.canceled_at

        stripe_subscription = cloned_stripe_subscription(
            subscription, cancel_at_period_end=False
        )

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ends_at is None
        assert updated_subscription.canceled_at is None
        assert_hooks_called_once(subscription_hooks, {"updated", "uncanceled"})

    async def test_valid_revokation(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        price = product.prices[0]
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(
            subscription, revoke=True
        )

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ended_at

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
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled", "revoked"})

    async def test_valid_cancel_and_revoke(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        subscription_hooks: Hooks,
        product: Product,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        price = product.prices[0]
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            price=price,
            customer=customer,
        )
        stripe_subscription = cloned_stripe_canceled_subscription(
            subscription,
        )

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.cancel_at_period_end is True
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled"})
        reset_hooks(subscription_hooks)

        # Now revoke
        stripe_subscription = cloned_stripe_canceled_subscription(
            updated_subscription, revoke=True
        )

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is False
        assert updated_subscription.ended_at

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
        assert_hooks_called_once(subscription_hooks, {"updated", "canceled", "revoked"})

    async def test_valid_new_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_hooks: Hooks,
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
        subscription = await create_active_subscription(
            save_fixture,
            product=product_recurring_free_price,
            price=free_price,
            customer=customer,
            stripe_subscription_id=stripe_subscription.id,
        )

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
        assert_hooks_called_once(subscription_hooks, {"updated"})

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
@pytest.mark.email_subscription_confirmation
async def test_send_confirmation_email(
    mocker: MockerFixture,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    customer: Customer,
) -> None:
    with WatcherEmailRenderer() as email_sender:
        mocker.patch("polar.subscription.service.enqueue_email", email_sender)

        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )

        async def _send_confirmation_email() -> None:
            await subscription_service.send_confirmation_email(session, subscription)

        await watch_email(_send_confirmation_email, email_sender.path)
