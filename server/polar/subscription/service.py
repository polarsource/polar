import contextlib
import uuid
from collections.abc import AsyncGenerator, Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal, cast, overload

import stripe as stripe_lib
import structlog
from sqlalchemy import select
from sqlalchemy.orm import contains_eager, selectinload

from polar.auth.models import AuthSubject
from polar.billing_entry.repository import BillingEntryRepository
from polar.billing_entry.service import MeteredLineItem
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.config import settings
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.repository import DiscountRedemptionRepository
from polar.discount.service import discount as discount_service
from polar.email.react import JSONProperty, render_email_template
from polar.email.sender import enqueue_email
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.event.service import event as event_service
from polar.event.system import SystemEvent, build_system_event
from polar.exceptions import (
    BadRequest,
    PolarError,
    PolarRequestValidationError,
    ResourceUnavailable,
)
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncReadSession, AsyncSession
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.logging import Logger
from polar.models import (
    Benefit,
    BenefitGrant,
    BillingEntry,
    Checkout,
    Customer,
    Discount,
    Organization,
    Payment,
    PaymentMethod,
    Product,
    ProductBenefit,
    Subscription,
    SubscriptionMeter,
    SubscriptionProductPrice,
    User,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.order import OrderBillingReason
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerNewPaidSubscriptionNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.organization.repository import OrganizationRepository
from polar.payment_method.service import payment_method as payment_method_service
from polar.product.guard import (
    is_custom_price,
    is_free_price,
    is_static_price,
)
from polar.product.repository import ProductRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import SubscriptionRepository
from .schemas import (
    SubscriptionCancel,
    SubscriptionRevoke,
    SubscriptionUpdate,
    SubscriptionUpdateDiscount,
    SubscriptionUpdateProduct,
)
from .sorting import SubscriptionSortProperty

log: Logger = structlog.get_logger()


class SubscriptionError(PolarError): ...


class NotARecurringProduct(SubscriptionError):
    def __init__(self, checkout: Checkout, product: Product) -> None:
        self.checkout = checkout
        self.product = product
        message = (
            f"Checkout {checkout.id} is for product {product.id}, "
            "which is not a recurring product."
        )
        super().__init__(message)


class MissingCheckoutCustomer(SubscriptionError):
    def __init__(self, checkout: Checkout) -> None:
        self.checkout = checkout
        message = f"Checkout {checkout.id} is missing a customer."
        super().__init__(message)


class InactiveSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = f"Subscription {subscription.id} is not active."
        super().__init__(message)


class SubscriptionDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str) -> None:
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received a subscription update from Stripe for {stripe_subscription_id}, "
            f"but no associated Subscription exists."
        )
        super().__init__(message)


class AlreadyCanceledSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            "This subscription is already canceled or will be at the end of the period."
        )
        super().__init__(message, 403)


class SubscriptionNotActiveOnStripe(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is not active on Stripe."
        super().__init__(message, 400)


class SubscriptionLocked(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is pending an update."
        super().__init__(message, 409)


class MissingStripeCustomerID(SubscriptionError):
    def __init__(self, checkout: Checkout, customer: Customer) -> None:
        self.checkout = checkout
        self.customer = customer
        message = (
            f"Checkout {checkout.id}'s customer {customer.id} "
            "is missing a Stripe customer ID."
        )
        super().__init__(message)


@overload
def _from_timestamp(t: int) -> datetime: ...


@overload
def _from_timestamp(t: None) -> None: ...


def _from_timestamp(t: int | None) -> datetime | None:
    if t is None:
        return None
    return datetime.fromtimestamp(t, UTC)


class SubscriptionService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        discount_id: Sequence[uuid.UUID] | None = None,
        active: bool | None = None,
        metadata: MetadataQuery | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SubscriptionSortProperty]] = [
            (SubscriptionSortProperty.started_at, True)
        ],
    ) -> tuple[Sequence[Subscription], int]:
        repository = SubscriptionRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Subscription.started_at.is_not(None))
            .join(Subscription.customer)
            .join(Subscription.discount, isouter=True)
        )

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Product.id.in_(product_id))

        if customer_id is not None:
            statement = statement.where(Subscription.customer_id.in_(customer_id))

        if external_customer_id is not None:
            statement = statement.where(Customer.external_id.in_(external_customer_id))

        if discount_id is not None:
            statement = statement.where(Subscription.discount_id.in_(discount_id))

        if active is not None:
            if active:
                statement = statement.where(Subscription.active.is_(True))
            else:
                statement = statement.where(Subscription.revoked.is_(True))

        if metadata is not None:
            statement = apply_metadata_clause(Subscription, statement, metadata)

        statement = repository.apply_sorting(statement, sorting)

        statement = statement.options(
            contains_eager(Subscription.product).options(
                selectinload(Product.product_medias),
                selectinload(Product.attached_custom_fields),
            ),
            contains_eager(Subscription.discount),
            contains_eager(Subscription.customer),
            selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
        )

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Subscription | None:
        repository = SubscriptionRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(
                Subscription.id == id,
                Subscription.started_at.is_not(None),
            )
            .options(
                *repository.get_eager_options(
                    product_load=contains_eager(Subscription.product)
                )
            )
        )
        return await repository.get_one_or_none(statement)

    async def create_or_update_from_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        payment_method: PaymentMethod | None = None,
    ) -> tuple[Subscription, bool]:
        product = checkout.product
        if not product.is_recurring:
            raise NotARecurringProduct(checkout, product)

        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        prices = product.prices
        recurring_interval: SubscriptionRecurringInterval
        if product.is_legacy_recurring_price:
            prices = [checkout.product_price]
            recurring_interval = prices[0].recurring_interval
        else:
            assert product.recurring_interval is not None
            recurring_interval = product.recurring_interval

        subscription_product_prices: list[SubscriptionProductPrice] = []
        for price in prices:
            subscription_product_prices.append(
                SubscriptionProductPrice.from_price(price, checkout.amount)
            )

        subscription = checkout.subscription
        created = False
        previous_is_canceled = subscription.canceled if subscription else False
        previous_status = subscription.status if subscription else None

        current_period_start = utc_now()
        current_period_end = recurring_interval.get_next_period(current_period_start)

        # New subscription
        if subscription is None:
            subscription = Subscription(
                started_at=current_period_start,
                cancel_at_period_end=False,
                customer=customer,
            )
            created = True

        # Even when updating from a free subscription, we change the current period:
        # we start a billing cycle from the checkout date.
        subscription.current_period_start = current_period_start
        subscription.current_period_end = current_period_end

        subscription.recurring_interval = recurring_interval
        subscription.status = SubscriptionStatus.active
        subscription.payment_method = payment_method
        subscription.product = product
        subscription.subscription_product_prices = subscription_product_prices
        subscription.discount = checkout.discount
        subscription.checkout = checkout
        subscription.user_metadata = checkout.user_metadata
        subscription.custom_field_data = checkout.custom_field_data

        repository = SubscriptionRepository.from_session(session)
        if created:
            subscription = await repository.create(subscription, flush=True)
            await self._after_subscription_created(session, subscription)
        else:
            subscription = await repository.update(subscription, flush=True)
            assert previous_status is not None
            await self._after_subscription_updated(
                session,
                subscription,
                previous_status=previous_status,
                previous_is_canceled=previous_is_canceled,
            )

        # Link potential discount redemption to the subscription
        if subscription.discount is not None:
            discount_redemption_repository = DiscountRedemptionRepository.from_session(
                session
            )
            await discount_redemption_repository.set_subscription_by_checkout(
                checkout.id, subscription.id
            )

        # Reset the subscription meters to start fresh
        await self.reset_meters(session, subscription)

        # Enqueue the benefits grants for the subscription
        await self.enqueue_benefits_grants(session, subscription)

        # Notify checkout channel that a subscription has been created from it
        await publish_checkout_event(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

        return subscription, created

    async def create_or_update_from_checkout_stripe(
        self,
        session: AsyncSession,
        checkout: Checkout,
        payment: Payment | None = None,
        payment_method: PaymentMethod | None = None,
    ) -> tuple[Subscription, bool]:
        idempotency_key = f"subscription_{checkout.id}{'' if payment is None else f'_{payment.processor_id}'}"
        product = checkout.product
        if not product.is_recurring:
            raise NotARecurringProduct(checkout, product)

        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        stripe_customer_id = customer.stripe_customer_id
        if stripe_customer_id is None:
            raise MissingStripeCustomerID(checkout, customer)

        metadata = {
            "type": ProductType.product,
            "product_id": str(checkout.product_id),
            "checkout_id": str(checkout.id),
        }
        invoice_metadata = {
            "checkout_id": str(checkout.id),
        }
        if payment is not None:
            invoice_metadata["charge_id"] = payment.processor_id

        stripe_price_ids: list[str] = []
        subscription_product_prices: list[SubscriptionProductPrice] = []

        prices = product.prices
        if product.is_legacy_recurring_price:
            prices = [checkout.product_price]

        free_pricing = True
        for price in prices:
            # For pay-what-you-want prices, we need to generate a dedicated price in Stripe
            if is_custom_price(price):
                ad_hoc_price = await stripe_service.create_ad_hoc_custom_price(
                    product,
                    price,
                    amount=checkout.amount,
                    currency=checkout.currency,
                    idempotency_key=f"{idempotency_key}_{price.id}",
                )
                stripe_price_ids.append(ad_hoc_price.id)
                subscription_product_prices.append(
                    SubscriptionProductPrice.from_price(price, checkout.amount)
                )
                free_pricing = False
            else:
                if is_static_price(price):
                    stripe_price_ids.append(price.stripe_price_id)
                if not is_free_price(price):
                    free_pricing = False
                subscription_product_prices.append(
                    SubscriptionProductPrice.from_price(price)
                )

        # We always need at least one price to create a subscription on Stripe
        # It happens if we only have metered prices on the product
        if len(stripe_price_ids) == 0:
            placeholder_price = await stripe_service.create_placeholder_price(
                product,
                checkout.currency,
                idempotency_key=f"{idempotency_key}_placeholder",
            )
            stripe_price_ids.append(placeholder_price.id)

        subscription = checkout.subscription
        new_subscription = False
        previous_is_canceled = subscription.canceled if subscription else False
        previous_status = subscription.status if subscription else None

        # Disable automatic tax for free pricing, since we don't collect customer address in that case
        automatic_tax = product.is_tax_applicable and not free_pricing

        # New subscription
        if subscription is None:
            assert product.stripe_product_id is not None
            (
                stripe_subscription,
                stripe_invoice,
            ) = await stripe_service.create_out_of_band_subscription(
                customer=stripe_customer_id,
                currency=checkout.currency,
                prices=stripe_price_ids,
                coupon=(
                    checkout.discount.stripe_coupon_id if checkout.discount else None
                ),
                automatic_tax=automatic_tax,
                metadata=metadata,
                invoice_metadata=invoice_metadata,
                idempotency_key=f"{idempotency_key}_create",
            )
            subscription = Subscription()
            new_subscription = True
        # Subscription upgrade
        else:
            assert subscription.stripe_subscription_id is not None
            (
                stripe_subscription,
                stripe_invoice,
            ) = await stripe_service.update_out_of_band_subscription(
                subscription_id=subscription.stripe_subscription_id,
                new_prices=stripe_price_ids,
                coupon=(
                    checkout.discount.stripe_coupon_id if checkout.discount else None
                ),
                automatic_tax=automatic_tax,
                metadata=metadata,
                invoice_metadata=invoice_metadata,
                idempotency_key=f"{idempotency_key}_update",
            )
        await stripe_service.set_automatically_charged_subscription(
            stripe_subscription.id,
            payment_method.processor_id if payment_method else None,
            idempotency_key=f"{idempotency_key}_payment_method",
        )

        subscription.stripe_subscription_id = stripe_subscription.id
        subscription.status = SubscriptionStatus(stripe_subscription.status)
        subscription.current_period_start = _from_timestamp(
            stripe_subscription.current_period_start
        )
        subscription.current_period_end = _from_timestamp(
            stripe_subscription.current_period_end
        )
        subscription.discount = checkout.discount
        subscription.customer = customer
        subscription.payment_method = payment_method
        subscription.product = product
        subscription.subscription_product_prices = subscription_product_prices
        subscription.checkout = checkout
        subscription.user_metadata = checkout.user_metadata
        subscription.custom_field_data = checkout.custom_field_data
        subscription.set_started_at()
        self.update_cancellation_from_stripe(subscription, stripe_subscription)

        if product.is_legacy_recurring_price:
            subscription.recurring_interval = prices[0].recurring_interval
        else:
            assert product.recurring_interval is not None
            subscription.recurring_interval = product.recurring_interval

        repository = SubscriptionRepository.from_session(session)
        if new_subscription:
            subscription = await repository.create(subscription, flush=True)
            await self._after_subscription_created(session, subscription)
        else:
            subscription = await repository.update(subscription, flush=True)
            assert previous_status is not None
            await self._after_subscription_updated(
                session,
                subscription,
                previous_status=previous_status,
                previous_is_canceled=previous_is_canceled,
            )

        # Link potential discount redemption to the subscription
        if subscription.discount is not None:
            discount_redemption_repository = DiscountRedemptionRepository.from_session(
                session
            )
            await discount_redemption_repository.set_subscription_by_checkout(
                checkout.id, subscription.id
            )

        # Reset the subscription meters to start fresh
        await self.reset_meters(session, subscription)

        # Notify checkout channel that a subscription has been created from it
        await publish_checkout_event(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

        return subscription, new_subscription

    async def cycle(
        self,
        session: AsyncSession,
        subscription: Subscription,
        update_cycle_dates: bool = True,
    ) -> Subscription:
        if not subscription.active:
            raise InactiveSubscription(subscription)

        revoke = subscription.cancel_at_period_end

        # Subscription is due to cancel, revoke it
        if revoke:
            subscription.ended_at = subscription.ends_at
            subscription.status = SubscriptionStatus.canceled

            event = await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.subscription_revoked,
                    customer=subscription.customer,
                    organization=subscription.organization,
                    metadata={"subscription_id": str(subscription.id)},
                ),
            )
            await self.enqueue_benefits_grants(session, subscription)
        # Normal cycle
        else:
            if update_cycle_dates:
                current_period_end = subscription.current_period_end
                assert current_period_end is not None
                subscription.current_period_start = current_period_end
                subscription.current_period_end = (
                    subscription.recurring_interval.get_next_period(current_period_end)
                )

            # Check if discount is still applicable
            if subscription.discount is not None:
                assert subscription.started_at is not None
                if subscription.discount.is_repetition_expired(
                    subscription.started_at, subscription.current_period_start
                ):
                    subscription.discount = None

            event = event = await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.subscription_cycled,
                    customer=subscription.customer,
                    organization=subscription.organization,
                    metadata={"subscription_id": str(subscription.id)},
                ),
            )
            # Add a billing entry for a new period
            billing_entry_repository = BillingEntryRepository.from_session(session)
            for subscription_product_price in subscription.subscription_product_prices:
                product_price = subscription_product_price.product_price
                if is_static_price(product_price):
                    discount_amount = 0
                    if subscription.discount:
                        discount_amount = subscription.discount.get_discount_amount(
                            subscription_product_price.amount
                        )

                    await billing_entry_repository.create(
                        BillingEntry(
                            start_timestamp=subscription.current_period_start,
                            end_timestamp=subscription.current_period_end,
                            type=BillingEntryType.cycle,
                            direction=BillingEntryDirection.debit,
                            amount=subscription_product_price.amount,
                            currency=subscription.currency,
                            customer=subscription.customer,
                            product_price=product_price,
                            discount=subscription.discount,
                            discount_amount=discount_amount,
                            subscription=subscription,
                            event=event,
                        ),
                    )

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(
            subscription, update_dict={"scheduler_locked_at": None}
        )

        enqueue_job(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReason.subscription_cycle,
        )

        await self.send_cycled_email(session, subscription)
        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=subscription.status,
            previous_is_canceled=subscription.canceled,
        )

        return subscription

    async def reset_meters(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        """
        Resets all the subscription meters to start fresh, optionally reporting
        rollover units if applicable.

        This should be called when creating a new subscription or cycling an
        existing one.
        """
        customer = subscription.customer
        for subscription_meter in subscription.meters:
            rollover_units = await customer_meter_service.get_rollover_units(
                session, customer, subscription_meter.meter
            )
            await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.meter_reset,
                    customer=customer,
                    organization=subscription.organization,
                    metadata={"meter_id": str(subscription_meter.meter_id)},
                ),
            )
            if rollover_units > 0:
                await event_service.create_event(
                    session,
                    build_system_event(
                        SystemEvent.meter_credited,
                        customer=customer,
                        organization=subscription.organization,
                        metadata={
                            "meter_id": str(subscription_meter.meter_id),
                            "units": rollover_units,
                            "rollover": True,
                        },
                    ),
                )

    async def _after_subscription_created(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_created
        )
        # ⚠️ In some cases, the subscription is immediately active
        # Make sure then to perform all the operations required!
        if subscription.active:
            await self._on_subscription_activated(session, subscription, False)

        enqueue_job(
            "customer.webhook",
            WebhookEventType.customer_state_changed,
            subscription.customer_id,
        )

    @contextlib.asynccontextmanager
    async def lock(
        self, locker: Locker, subscription: Subscription
    ) -> AsyncGenerator[Subscription]:
        lock_name = f"subscription:{subscription.id}"
        if await locker.is_locked(lock_name):
            raise SubscriptionLocked(subscription)
        async with locker.lock(
            lock_name,
            timeout=10.0,  # Quite long, but we've experienced slow responses from Stripe in test mode
            blocking_timeout=1,
        ):
            yield subscription

    async def update(
        self,
        session: AsyncSession,
        locker: Locker,
        subscription: Subscription,
        *,
        update: SubscriptionUpdate,
    ) -> Subscription:
        if isinstance(update, SubscriptionUpdateProduct):
            if subscription.revoked or subscription.cancel_at_period_end:
                raise AlreadyCanceledSubscription(subscription)
            return await self.update_product(
                session,
                subscription,
                product_id=update.product_id,
                proration_behavior=update.proration_behavior,
            )

        if isinstance(update, SubscriptionUpdateDiscount):
            return await self.update_discount(
                session,
                locker,
                subscription,
                discount_id=update.discount_id,
            )

        if isinstance(update, SubscriptionCancel):
            cancel = update.cancel_at_period_end is True
            uncancel = update.cancel_at_period_end is False

            if uncancel:
                return await self.uncancel(session, subscription)

            return await self.cancel(
                session,
                subscription,
                customer_reason=update.customer_cancellation_reason,
                customer_comment=update.customer_cancellation_comment,
            )

        if isinstance(update, SubscriptionRevoke):
            return await self._perform_cancellation(
                session,
                subscription,
                customer_reason=update.customer_cancellation_reason,
                customer_comment=update.customer_cancellation_comment,
                immediately=True,
            )

    async def update_product(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        product_id: uuid.UUID,
        proration_behavior: SubscriptionProrationBehavior | None = None,
    ) -> Subscription:
        previous_product = subscription.product
        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id_and_organization(
            product_id,
            subscription.product.organization_id,
            options=product_repository.get_eager_options(),
        )

        if product is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product does not exist.",
                        "input": product_id,
                    }
                ]
            )

        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product is archived.",
                        "input": product_id,
                    }
                ]
            )

        if not product.is_recurring:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product is not recurring.",
                        "input": product_id,
                    }
                ]
            )

        if product.is_legacy_recurring_price:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product has legacy recurring prices.",
                        "input": product_id,
                    }
                ]
            )
        assert previous_product.recurring_interval is not None
        assert product.recurring_interval is not None

        prices = product.prices

        for price in prices:
            if is_custom_price(price):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "product_id"),
                            "msg": "Can't update to a product with custom prices.",
                            "input": product_id,
                        }
                    ]
                )

        # Add event for the subscription plan change
        event = await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_product_updated,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata={
                    "subscription_id": str(subscription.id),
                    "old_product_id": str(previous_product.id),
                    "new_product_id": str(product.id),
                },
            ),
        )

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(product.organization_id)
        assert organization is not None

        subscription.product = product
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price) for price in prices
        ]
        subscription.recurring_interval = product.recurring_interval

        if proration_behavior is None:
            proration_behavior = organization.proration_behavior

        if subscription.stripe_subscription_id:
            # Stripe behavior
            stripe_price_ids = [
                price.stripe_price_id for price in prices if is_static_price(price)
            ]

            # If no static prices (only metered), create a placeholder price
            if len(stripe_price_ids) == 0:
                placeholder_price = await stripe_service.create_placeholder_price(
                    product,
                    subscription.currency,
                    idempotency_key=f"subscription_update_{subscription.id}_placeholder",
                )
                stripe_price_ids.append(placeholder_price.id)

            await stripe_service.update_subscription_price(
                subscription.stripe_subscription_id,
                new_prices=stripe_price_ids,
                proration_behavior=proration_behavior.to_stripe(),
                metadata={
                    "type": ProductType.product,
                    "product_id": str(product.id),
                },
            )

            session.add(subscription)
            await session.flush()
        else:
            now = datetime.now(UTC)

            # Cycle end can change in the case of e.g. monthly to yearly
            old_cycle_start = subscription.current_period_start
            old_cycle_end = previous_product.recurring_interval.get_next_period(
                subscription.current_period_start
            )

            if previous_product.recurring_interval != product.recurring_interval:
                # If switching from monthly to yearly or yearly to monthly, we
                # set the cycle start to now
                subscription.current_period_start = now

            new_cycle_start = subscription.current_period_start
            new_cycle_end = subscription.recurring_interval.get_next_period(
                subscription.current_period_start
            )

            old_cycle_remaining_time = (old_cycle_end - now).total_seconds()
            old_cycle_total_time = (old_cycle_end - old_cycle_start).total_seconds()
            old_cycle_pct_remaining = old_cycle_remaining_time / old_cycle_total_time

            new_cycle_remaining_time = (new_cycle_end - now).total_seconds()
            new_cycle_total_time = (new_cycle_end - new_cycle_start).total_seconds()
            new_cycle_pct_remaining = new_cycle_remaining_time / new_cycle_total_time

            subscription.current_period_end = new_cycle_end

            # Admittedly, this gets a little crazy, but in theory you could go
            # from a product with 1 static price to one with 2 static prices or
            # the other way around. We don't generally support multiple static
            # prices.
            #
            # But should we get there, we'll debit you for both of those prices.
            # Similarly, if going from 2 static prices to 1 static price, we'll
            # credit you for both prices and debit you for the 1 price.
            #
            # Metered prices are ignored for prorations.
            old_static_prices = [
                p for p in previous_product.prices if is_static_price(p)
            ]
            new_static_prices = [p for p in product.prices if is_static_price(p)]

            for old_price in old_static_prices:
                base_amount = old_price.price_amount  # type: ignore
                discount_amount = 0
                if subscription.discount:
                    discount_amount = subscription.discount.get_discount_amount(
                        base_amount
                    )

                # Prorations have discounts applied to the `BillingEntry.amount`
                # immediately.
                # This is because we're really applying the discount from "this" cycle
                # whereas the `cycle` and `meter` BillingEntries should use the
                # discount from the _next_ cycle -- the discount that applies to
                # that upcoming order. applies to next order applies to the
                # For example, if you have a flat "$20 off" discount, part of that
                # $20 discount should _not_ apply to the prorations because the
                # prorations are happening "this cycle" and shouldn't take away
                # from next cycle's discount.
                entry_unused_time = BillingEntry(
                    type=BillingEntryType.proration,
                    direction=BillingEntryDirection.credit,
                    start_timestamp=now,
                    end_timestamp=old_cycle_end,
                    amount=round(
                        (base_amount - discount_amount) * old_cycle_pct_remaining
                    ),
                    discount_amount=discount_amount,
                    currency=subscription.currency,
                    customer_id=subscription.customer_id,
                    product_price_id=old_price.id,
                    subscription_id=subscription.id,
                    event_id=event.id,
                    order_item_id=None,
                )
                session.add(entry_unused_time)

            if previous_product.recurring_interval == product.recurring_interval:
                # If switching from monthly to yearly or yearly to monthly, we trigger a cycle immediately
                # that means a debit billing entry for the new cycle will be added automatically.
                # So debit prorations only apply when the cycle interval is the same.
                for new_price in new_static_prices:
                    base_amount = new_price.price_amount  # type: ignore
                    discount_amount = 0
                    if subscription.discount and subscription.discount.is_applicable(
                        new_price.product
                    ):
                        discount_amount = subscription.discount.get_discount_amount(
                            base_amount
                        )
                    entry_remaining_time = BillingEntry(
                        type=BillingEntryType.proration,
                        direction=BillingEntryDirection.debit,
                        start_timestamp=now,
                        end_timestamp=new_cycle_end,
                        amount=round(
                            (base_amount - discount_amount) * new_cycle_pct_remaining
                        ),
                        discount_amount=discount_amount,
                        currency=subscription.currency,
                        customer_id=subscription.customer_id,
                        product_price_id=new_price.id,
                        subscription_id=subscription.id,
                        event_id=event.id,
                        order_item_id=None,
                    )
                    session.add(entry_remaining_time)

            session.add(subscription)
            await session.flush()

            if previous_product.recurring_interval != product.recurring_interval:
                # If switching from monthly to yearly or yearly to monthly, we trigger a cycle immediately
                await self.cycle(session, subscription, update_cycle_dates=False)
            elif proration_behavior == SubscriptionProrationBehavior.invoice:
                # Invoice immediately
                enqueue_job(
                    "order.create_subscription_order",
                    subscription.id,
                    OrderBillingReason.subscription_update,
                )
            elif proration_behavior == SubscriptionProrationBehavior.prorate:
                # Add prorations to next invoice
                pass

            await self.enqueue_benefits_grants(session, subscription)

        # Send product change email notification
        await self.send_subscription_updated_email(
            session, subscription, previous_product, product, proration_behavior
        )

        # Trigger subscription updated events and re-evaluate benefits
        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )

        return subscription

    async def update_discount(
        self,
        session: AsyncSession,
        locker: Locker,
        subscription: Subscription,
        *,
        discount_id: uuid.UUID | None = None,
    ) -> Subscription:
        discount: Discount | None = None

        if discount_id is not None:
            discount = await discount_service.get_by_id_and_organization(
                session,
                discount_id,
                subscription.organization,
                products=[subscription.product],
            )
            if discount is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "discount_id"),
                            "msg": (
                                "Discount does not exist, "
                                "is not applicable to this product "
                                "or is not redeemable."
                            ),
                            "input": discount_id,
                        }
                    ]
                )
            if discount == subscription.discount:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "discount_id"),
                            "msg": "This discount is already applied to the subscription.",
                            "input": discount_id,
                        }
                    ]
                )

        async def _update_discount(
            session: AsyncSession,
            subscription: Subscription,
            discount: Discount | None,
        ) -> Subscription:
            if subscription.stripe_subscription_id is not None:
                old_coupon_id = (
                    subscription.discount.stripe_coupon_id
                    if subscription.discount is not None
                    else None
                )
                new_coupon_id = (
                    discount.stripe_coupon_id if discount is not None else None
                )
                await stripe_service.update_subscription_discount(
                    subscription.stripe_subscription_id, old_coupon_id, new_coupon_id
                )
            repository = SubscriptionRepository.from_session(session)
            return await repository.update(
                subscription, update_dict={"discount": discount}, flush=True
            )

        if discount is None:
            return await _update_discount(session, subscription, None)

        async with discount_service.redeem_discount(
            session, locker, discount
        ) as discount_redemption:
            discount_redemption.subscription = subscription
            return await _update_discount(session, subscription, discount)

    async def uncancel(
        self, session: AsyncSession, subscription: Subscription
    ) -> Subscription:
        if subscription.ended_at:
            raise ResourceUnavailable()

        if not (subscription.active and subscription.cancel_at_period_end):
            raise BadRequest()

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        # Managed by Stripe
        if subscription.stripe_subscription_id is not None:
            stripe_subscription = await stripe_service.uncancel_subscription(
                subscription.stripe_subscription_id,
            )
            self.update_cancellation_from_stripe(subscription, stripe_subscription)
        # Managed by our billing
        else:
            subscription.cancel_at_period_end = False
            subscription.ends_at = None

        subscription.canceled_at = None
        subscription.customer_cancellation_reason = None
        subscription.customer_cancellation_comment = None
        session.add(subscription)

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )
        return subscription

    async def revoke(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
    ) -> Subscription:
        return await self._perform_cancellation(
            session,
            subscription,
            customer_reason=customer_reason,
            customer_comment=customer_comment,
            immediately=True,
        )

    async def cancel(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
    ) -> Subscription:
        return await self._perform_cancellation(
            session,
            subscription,
            customer_reason=customer_reason,
            customer_comment=customer_comment,
        )

    async def cancel_customer(
        self, session: AsyncSession, customer_id: uuid.UUID
    ) -> None:
        subscription_repository = SubscriptionRepository.from_session(session)
        subscriptions = await subscription_repository.list_active_by_customer(
            customer_id
        )
        for subscription in subscriptions:
            await self._perform_cancellation(session, subscription, immediately=True)

    async def update_from_stripe(
        self,
        session: AsyncSession,
        locker: Locker,
        *,
        stripe_subscription: stripe_lib.Subscription,
    ) -> Subscription:
        """
        Since Stripe manages the billing cycle, listen for their webhooks and update the
        status and dates accordingly.
        """
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.get_by_stripe_subscription_id(
            stripe_subscription.id, options=repository.get_eager_options()
        )

        if subscription is None:
            raise SubscriptionDoesNotExist(stripe_subscription.id)

        async with self.lock(locker, subscription):
            previous_status = subscription.status
            previous_is_canceled = subscription.canceled

            subscription.status = SubscriptionStatus(stripe_subscription.status)
            subscription.current_period_start = _from_timestamp(
                stripe_subscription.current_period_start
            )
            subscription.current_period_end = _from_timestamp(
                stripe_subscription.current_period_end
            )
            subscription.set_started_at()
            self.update_cancellation_from_stripe(subscription, stripe_subscription)
            # Reset discount if it has expired
            if (
                len(stripe_subscription.discounts) == 0
                and subscription.discount is not None
            ):
                subscription.discount = None

            # Update payment method
            if stripe_subscription.default_payment_method is not None:
                stripe_payment_method = await stripe_service.get_payment_method(
                    get_expandable_id(stripe_subscription.default_payment_method)
                )
                payment_method = await payment_method_service.upsert_from_stripe(
                    session, subscription.customer, stripe_payment_method
                )
                subscription.payment_method = payment_method

            subscription = await repository.update(subscription)

            await self.enqueue_benefits_grants(session, subscription)
            await self._after_subscription_updated(
                session,
                subscription,
                previous_status=previous_status,
                previous_is_canceled=previous_is_canceled,
            )
            return subscription

    async def _perform_cancellation(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
        immediately: bool = False,
    ) -> Subscription:
        if not subscription.can_cancel(immediately):
            raise AlreadyCanceledSubscription(subscription)

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        now = utc_now()
        subscription.canceled_at = now

        if customer_reason:
            subscription.customer_cancellation_reason = customer_reason

        if customer_comment:
            subscription.customer_cancellation_comment = customer_comment

        # Managed by Stripe
        if subscription.stripe_subscription_id is not None:
            reason = customer_reason.value if customer_reason else None
            if immediately:
                stripe_subscription = await stripe_service.revoke_subscription(
                    subscription.stripe_subscription_id,
                    customer_reason=reason,  # type: ignore
                    customer_comment=customer_comment,
                )
            else:
                stripe_subscription = await stripe_service.cancel_subscription(
                    subscription.stripe_subscription_id,
                    customer_reason=reason,  # type: ignore
                    customer_comment=customer_comment,
                )

            subscription.status = SubscriptionStatus(stripe_subscription.status)
            self.update_cancellation_from_stripe(subscription, stripe_subscription)
        # Managed by our billing
        else:
            if immediately:
                subscription.ends_at = now
                subscription.ended_at = now
                subscription.status = SubscriptionStatus.canceled
                await self.enqueue_benefits_grants(session, subscription)
            else:
                subscription.cancel_at_period_end = True
                subscription.ends_at = subscription.current_period_end

        log.info(
            "subscription.canceled",
            id=subscription.id,
            status=subscription.status,
            immediately=immediately,
            ends_at=subscription.ends_at,
            ended_at=subscription.ended_at,
            reason=customer_reason,
        )
        session.add(subscription)

        # Trigger hooks since we update subscriptions directly upon cancellation
        # Doing so upon Stripe webhooks would prevent us from truly
        # knowing/identifying changes made, i.e cancellations.
        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )
        return subscription

    def update_cancellation_from_stripe(
        self, subscription: Subscription, stripe_subscription: stripe_lib.Subscription
    ) -> None:
        previous_ends_at = subscription.ends_at

        subscription.cancel_at_period_end = stripe_subscription.cancel_at_period_end
        subscription.ended_at = _from_timestamp(stripe_subscription.ended_at)

        is_canceled = subscription.cancel_at_period_end or subscription.ended_at
        is_uncanceled = previous_ends_at and not is_canceled
        if not is_canceled or is_uncanceled:
            subscription.ends_at = None
            subscription.canceled_at = None
            return

        if subscription.ended_at:
            subscription.ends_at = subscription.ended_at
        elif subscription.cancel_at_period_end:
            subscription.ends_at = subscription.current_period_end

        # Use our own if set already (more accurate).
        canceled_at = _from_timestamp(stripe_subscription.canceled_at)
        if canceled_at and not subscription.canceled_at:
            subscription.canceled_at = canceled_at

    async def update_meters(
        self, session: AsyncSession, subscription: Subscription
    ) -> Subscription:
        # First reset all meters, since we're computing from every entry
        for subscription_meter in subscription.meters:
            subscription_meter.reset()

        async for (
            line_item,
            _,
        ) in billing_entry_service.compute_pending_subscription_line_items(
            session, subscription
        ):
            if not isinstance(line_item, MeteredLineItem):
                continue
            subscription_meter_line = subscription.get_meter(line_item.price.meter)
            if subscription_meter_line is not None:
                subscription_meter_line.consumed_units += Decimal(
                    line_item.consumed_units
                )
                subscription_meter_line.credited_units += line_item.credited_units
                subscription_meter_line.amount += line_item.amount

        session.add(subscription)
        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=subscription.status,
            previous_is_canceled=subscription.canceled,
        )

        return subscription

    async def _after_subscription_updated(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        previous_status: SubscriptionStatus,
        previous_is_canceled: bool,
    ) -> None:
        await self._on_subscription_updated(session, subscription)

        became_activated = subscription.active and not SubscriptionStatus.is_active(
            previous_status
        )
        became_reactivated = (
            became_activated and previous_status == SubscriptionStatus.past_due
        )
        became_past_due = (
            subscription.status == SubscriptionStatus.past_due
            and previous_status != SubscriptionStatus.past_due
        )
        became_canceled = subscription.canceled and not previous_is_canceled
        became_uncanceled = not subscription.canceled and previous_is_canceled
        became_revoked = subscription.revoked and not SubscriptionStatus.is_revoked(
            previous_status
        )

        if became_activated:
            await self._on_subscription_activated(
                session, subscription, became_reactivated
            )

        if became_uncanceled:
            await self._on_subscription_uncanceled(session, subscription)

        if became_past_due:
            await self._on_subscription_past_due(session, subscription)

        if became_canceled:
            await self._on_subscription_canceled(
                session, subscription, revoked=became_revoked
            )

        if became_revoked:
            await self._on_subscription_revoked(
                session, subscription, past_due=became_past_due
            )

        enqueue_job(
            "customer.webhook",
            WebhookEventType.customer_state_changed,
            subscription.customer_id,
        )

    async def _on_subscription_updated(
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_updated
        )

    async def _on_subscription_activated(
        self,
        session: AsyncSession,
        subscription: Subscription,
        reactivated: bool,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_active
        )

        await self.send_confirmation_email(session, subscription)

        # Only send merchant notification if the subscription is a new one,
        # not a past due that has been reactivated.
        if not reactivated:
            await self._send_new_subscription_notification(session, subscription)

    async def _on_subscription_past_due(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self.send_past_due_email(session, subscription)

    async def _on_subscription_uncanceled(
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_uncanceled
        )
        await self.send_uncanceled_email(session, subscription)

    async def _on_subscription_canceled(
        self,
        session: AsyncSession,
        subscription: Subscription,
        revoked: bool,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_canceled
        )

        # Only send cancellation email if the subscription is not revoked,
        # as revocation has its own email.
        if not revoked:
            await self.send_cancellation_email(session, subscription)

    async def _on_subscription_revoked(
        self,
        session: AsyncSession,
        subscription: Subscription,
        past_due: bool,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_revoked
        )

        # Only send revoked email if the subscription is not past due,
        # as past due has its own email.
        if not past_due:
            await self.send_revoked_email(session, subscription)

    async def _send_new_subscription_notification(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        product = subscription.product

        if product.organization.notification_settings["new_subscription"]:
            await notifications_service.send_to_org_members(
                session,
                org_id=product.organization_id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_new_paid_subscription,
                    payload=MaintainerNewPaidSubscriptionNotificationPayload(
                        subscriber_name=subscription.customer.email,
                        tier_name=product.name,
                        tier_price_amount=subscription.amount,
                        tier_price_recurring_interval=subscription.recurring_interval,
                        tier_organization_name=subscription.organization.name,
                    ),
                ),
            )

    async def _send_webhook(
        self,
        session: AsyncSession,
        subscription: Subscription,
        event_type: Literal[
            WebhookEventType.subscription_created,
            WebhookEventType.subscription_updated,
            WebhookEventType.subscription_active,
            WebhookEventType.subscription_canceled,
            WebhookEventType.subscription_uncanceled,
            WebhookEventType.subscription_revoked,
        ],
    ) -> None:
        repository = SubscriptionRepository.from_session(session)
        subscription = cast(
            Subscription,
            await repository.get_by_id(
                subscription.id, options=repository.get_eager_options()
            ),
        )
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(
            subscription.product_id, options=product_repository.get_eager_options()
        )
        if product is not None:
            await webhook_service.send(
                session, product.organization, event_type, subscription
            )

    async def enqueue_benefits_grants(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(subscription.product_id)
        assert product is not None

        if subscription.is_incomplete():
            return

        task = "grant" if subscription.active else "revoke"

        enqueue_job(
            "benefit.enqueue_benefits_grants",
            task=task,
            customer_id=subscription.customer_id,
            product_id=product.id,
            subscription_id=subscription.id,
        )

    async def update_product_benefits_grants(
        self, session: AsyncSession, product: Product
    ) -> None:
        statement = select(Subscription).where(
            Subscription.product_id == product.id, Subscription.deleted_at.is_(None)
        )
        subscriptions = await session.stream_scalars(statement)
        async for subscription in subscriptions:
            await self.enqueue_benefits_grants(session, subscription)

    async def send_confirmation_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription",
            template_name="subscription_confirmation",
        )

    async def send_cycled_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription has been renewed",
            template_name="subscription_cycled",
        )

    async def send_uncanceled_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription is uncanceled",
            template_name="subscription_uncanceled",
        )

    async def send_cancellation_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription cancellation",
            template_name="subscription_cancellation",
        )

    async def send_revoked_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription has ended",
            template_name="subscription_revoked",
        )

    async def send_past_due_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        """Send past due email to customer with optional payment link."""
        payment_url = None

        # Try to get payment link from Stripe if available
        if subscription.stripe_subscription_id:
            try:
                stripe_subscription = await stripe_lib.Subscription.retrieve_async(
                    subscription.stripe_subscription_id
                )
                if stripe_subscription.latest_invoice:
                    invoice_id = get_expandable_id(stripe_subscription.latest_invoice)
                    invoice = await stripe_service.get_invoice(invoice_id)
                    if invoice.hosted_invoice_url:
                        payment_url = invoice.hosted_invoice_url
            except Exception:
                # If we can't get the payment link, continue without it
                pass

        # Only include payment_url if it's not None
        extra_context: dict[str, JSONProperty] = {}
        if payment_url is not None:
            extra_context["payment_url"] = payment_url

        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription payment is past due",
            template_name="subscription_past_due",
            extra_context=extra_context if extra_context else None,
        )

    async def send_subscription_updated_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        previous_product: Product,
        new_product: Product,
        proration_behavior: SubscriptionProrationBehavior,
    ) -> None:
        subject = f"Your subscription has changed to {new_product.name}"
        return await self._send_customer_email(
            session,
            subscription,
            subject_template=subject,
            template_name="subscription_updated",
            extra_context={
                "proration_behavior": proration_behavior,
                "previous_product": previous_product.email_props,
            },
        )

    async def _send_customer_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        subject_template: str,
        template_name: str,
        extra_context: dict[str, JSONProperty] | None = None,
    ) -> None:
        product = subscription.product
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            product.organization_id,
            # We block organizations in case of fraud and then refund/cancel
            # so make sure we can still fetch them for the purpose of sending
            # customer emails.
            include_deleted=True,
            include_blocked=True,
        )
        assert organization is not None

        customer = subscription.customer
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        context: dict[str, JSONProperty] = {
            "organization": organization.email_props,
            "product": product.email_props,
            "subscription": {
                "ends_at": subscription.ends_at.isoformat()
                if subscription.ends_at
                else "",
            },
            "url": settings.generate_frontend_url(
                f"/{organization.slug}/portal?customer_session_token={token}&id={subscription.id}"
            ),
        }

        # Add extra context if provided
        if extra_context:
            context.update(extra_context)

        body = render_email_template(template_name, context)

        subject = subject_template.format(product=product)

        enqueue_email(
            **organization.email_from_reply,
            to_email_addr=subscription.customer.email,
            subject=subject,
            html_content=body,
        )

    async def _get_outdated_grants(
        self,
        session: AsyncSession,
        subscription: Subscription,
        current_subscription_tier: Product,
    ) -> Sequence[BenefitGrant]:
        subscription_tier_benefits_statement = (
            select(Benefit.id)
            .join(ProductBenefit)
            .where(ProductBenefit.product_id == current_subscription_tier.id)
        )

        statement = select(BenefitGrant).where(
            BenefitGrant.subscription_id == subscription.id,
            BenefitGrant.benefit_id.not_in(subscription_tier_benefits_statement),
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def mark_past_due(
        self, session: AsyncSession, subscription: Subscription
    ) -> Subscription:
        """Mark a subscription as past due. Main use case is to set it when payment fails.
        When this happens the customer will be notified and lose access to the benefits"""

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(
            subscription, update_dict={"status": SubscriptionStatus.past_due}
        )

        # Trigger subscription updated events
        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )
        # Cancel all grants for this subscription
        await self.enqueue_benefits_grants(session, subscription)

        return subscription

    async def mark_active(
        self, session: AsyncSession, subscription: Subscription
    ) -> Subscription:
        """Mark a subscription as active. Used when payment succeeds after being past due."""

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(
            subscription, update_dict={"status": SubscriptionStatus.active}
        )

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )
        await self.enqueue_benefits_grants(session, subscription)

        return subscription

    async def update_payment_method_from_retry(
        self,
        session: AsyncSession,
        subscription: Subscription,
        payment_method: PaymentMethod,
    ) -> Subscription:
        """
        Update subscription payment method after successful retry payment.

        This method updates both the local subscription record and the Stripe
        subscription (if Stripe-managed) to use the new payment method as default.
        """
        if subscription.stripe_subscription_id:
            await stripe_service.set_automatically_charged_subscription(
                subscription.stripe_subscription_id, payment_method.processor_id
            )

        subscription.payment_method = payment_method
        repository = SubscriptionRepository.from_session(session)
        return await repository.update(subscription)


subscription = SubscriptionService()
