import contextlib
import uuid
from collections.abc import AsyncGenerator, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, cast, overload
from urllib.parse import urlencode

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager, selectinload

from polar.auth.models import AuthSubject
from polar.billing_entry.repository import BillingEntryRepository
from polar.billing_entry.service import MeteredLineItem
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.guard import has_product_checkout
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.customer_seat.service import seat_service
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.repository import DiscountRedemptionRepository
from polar.discount.service import discount as discount_service
from polar.email.schemas import EmailAdapter
from polar.email.sender import enqueue_email_template
from polar.enums import (
    PaymentMode,
    SubscriptionProrationBehavior,
    SubscriptionRecurringInterval,
)
from polar.event.service import event as event_service
from polar.event.system import (
    SubscriptionCanceledMetadata,
    SubscriptionCreatedMetadata,
    SubscriptionCycledMetadata,
    SubscriptionRevokedMetadata,
    SubscriptionUncanceledMetadata,
    SystemEvent,
    build_system_event,
)
from polar.exceptions import (
    BadRequest,
    PolarError,
    PolarRequestValidationError,
    ResourceUnavailable,
    ValidationError,
)
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
    Order,
    Organization,
    PaymentMethod,
    Product,
    ProductBenefit,
    Subscription,
    SubscriptionMeter,
    SubscriptionProductPrice,
    User,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.order import OrderBillingReasonInternal
from polar.models.product import ProductVisibility
from polar.models.product_price import ProductPrice, ProductPriceSeatUnit
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerNewPaidSubscriptionNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.organization.repository import OrganizationRepository
from polar.product.guard import (
    is_custom_price,
    is_free_price,
    is_recurring_product,
    is_seat_price,
    is_static_price,
)
from polar.product.price_set import NoPricesForCurrencies, PriceSet
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.tax.calculation import TaxCalculationLogicalError
from polar.tax.calculation import tax_calculation as tax_calculation_service
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job, make_bulk_job_delay_calculator

from .repository import SubscriptionRepository
from .schemas import (
    SubscriptionCancel,
    SubscriptionChargePreview,
    SubscriptionCreate,
    SubscriptionCreateCustomer,
    SubscriptionRevoke,
    SubscriptionUpdate,
    SubscriptionUpdateBillingPeriod,
    SubscriptionUpdateDiscount,
    SubscriptionUpdateProduct,
    SubscriptionUpdateSeats,
    SubscriptionUpdateTrial,
)
from .sorting import SubscriptionSortProperty
from .update import generate_subscription_update

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
        super().__init__(message, 403)


class AlreadyCanceledSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            "This subscription is already canceled or will be at the end of the period."
        )
        super().__init__(message, 403)


class TrialingSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            "This subscription is currently in a trial period and cannot be updated."
        )
        super().__init__(message, 403)


class SubscriptionLocked(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is pending an update."
        super().__init__(message, 409)


class NotASeatBasedSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription does not support seat-based pricing."
        super().__init__(message, 400)


class SeatsAlreadyAssigned(SubscriptionError):
    def __init__(
        self, subscription: Subscription, assigned_count: int, requested_seats: int
    ) -> None:
        self.subscription = subscription
        self.assigned_count = assigned_count
        self.requested_seats = requested_seats
        message = (
            f"Cannot decrease seats to {requested_seats}. "
            f"Currently {assigned_count} seats are assigned. "
            f"Revoke seats first."
        )
        super().__init__(message, 400)


class BelowMinimumSeats(SubscriptionError):
    def __init__(
        self, subscription: Subscription, minimum_seats: int, requested_seats: int
    ) -> None:
        self.subscription = subscription
        self.minimum_seats = minimum_seats
        self.requested_seats = requested_seats
        message = f"Minimum {minimum_seats} seats required."
        super().__init__(message, 400)


class AboveMaximumSeats(SubscriptionError):
    def __init__(
        self, subscription: Subscription, maximum_seats: int, requested_seats: int
    ) -> None:
        self.subscription = subscription
        self.maximum_seats = maximum_seats
        self.requested_seats = requested_seats
        message = f"Maximum {maximum_seats} seats allowed."
        super().__init__(message, 400)


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
        cancel_at_period_end: bool | None = None,
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

        if cancel_at_period_end is not None:
            statement = statement.where(
                Subscription.cancel_at_period_end.is_(cancel_at_period_end)
            )

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

    async def create(
        self,
        session: AsyncSession,
        subscription_create: SubscriptionCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Subscription:
        errors: list[ValidationError] = []

        product = await product_service.get(
            session, auth_subject, subscription_create.product_id
        )
        if product is None:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "product_id"),
                    "msg": "Product does not exist.",
                    "input": subscription_create.product_id,
                }
            )
        elif not product.is_recurring:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "product_id"),
                    "msg": "Product is not a recurring product.",
                    "input": subscription_create.product_id,
                }
            )
        elif product.is_legacy_recurring_price:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "product_id"),
                    "msg": "Legacy recurring products are not supported.",
                    "input": subscription_create.product_id,
                }
            )
        elif (
            default_price := PriceSet.from_product(
                product, product.organization.default_presentment_currency
            ).get_default_price()
        ) and not is_free_price(default_price):
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "product_id"),
                    "msg": (
                        "Product is not free. "
                        "The customer should go through a checkout to create a paid subscription."
                    ),
                    "input": subscription_create.product_id,
                }
            )

        customer: Customer | None = None
        customer_repository = CustomerRepository.from_session(session)
        error_loc: str
        input_value: uuid.UUID | str
        if isinstance(subscription_create, SubscriptionCreateCustomer):
            error_loc = "customer_id"
            input_value = subscription_create.customer_id
            customer = await customer_repository.get_readable_by_id(
                auth_subject, input_value
            )
        else:
            error_loc = "external_customer_id"
            input_value = subscription_create.external_customer_id
            customer = await customer_repository.get_readable_by_external_id(
                auth_subject, input_value
            )

        if customer is None:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", error_loc),
                    "msg": "Customer does not exist.",
                    "input": input_value,
                }
            )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        assert product is not None
        assert customer is not None

        assert is_recurring_product(product)
        recurring_interval = product.recurring_interval
        recurring_interval_count = product.recurring_interval_count

        currency = product.organization.default_presentment_currency
        currency_prices = PriceSet.from_product(product, currency)
        subscription_product_prices: list[SubscriptionProductPrice] = []
        for price in currency_prices:
            subscription_product_prices.append(
                SubscriptionProductPrice.from_price(price)
            )

        current_period_start = utc_now()
        current_period_end = recurring_interval.get_next_period(
            current_period_start, recurring_interval_count
        )

        subscription = Subscription(
            status=SubscriptionStatus.active,
            started_at=current_period_start,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            cancel_at_period_end=False,
            recurring_interval=recurring_interval,
            recurring_interval_count=recurring_interval_count,
            product=product,
            customer=customer,
            subscription_product_prices=subscription_product_prices,
            currency=currency,
            user_metadata=subscription_create.metadata,
        )

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.create(subscription, flush=True)

        await self._after_subscription_created(session, subscription)
        # ⚠️ Some users are relying on `subscription.updated` for everything
        # It was working before with Stripe since it always triggered an update
        # after creation.
        # But that's not the case with our new engine.
        # So we manually trigger it here to keep the same behavior.
        await self._on_subscription_updated(session, subscription)

        # Enqueue the benefits grants for the subscription
        await self.enqueue_benefits_grants(session, subscription)

        return subscription

    async def create_or_update_from_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        payment_method: PaymentMethod | None = None,
    ) -> tuple[Subscription, bool]:
        assert has_product_checkout(checkout)

        product = checkout.product
        if not product.is_recurring:
            raise NotARecurringProduct(checkout, product)

        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        currency = checkout.currency
        currency_prices = PriceSet.from_prices(checkout.prices[product.id], currency)
        recurring_interval: SubscriptionRecurringInterval
        recurring_interval_count: int
        subscription_prices: list[ProductPrice]
        if product.is_legacy_recurring_price:
            # For legacy products, use only the selected price from checkout
            subscription_prices = [checkout.product_price]
            recurring_interval = subscription_prices[0].recurring_interval
            recurring_interval_count = 1
        else:
            assert is_recurring_product(product)
            recurring_interval = product.recurring_interval
            recurring_interval_count = product.recurring_interval_count
            subscription_prices = list(currency_prices)

        subscription_product_prices: list[SubscriptionProductPrice] = []
        for price in subscription_prices:
            subscription_product_prices.append(
                SubscriptionProductPrice.from_price(
                    price, checkout.amount, checkout.seats
                )
            )

        subscription = checkout.subscription
        created = False
        previous_is_canceled = subscription.canceled if subscription else False
        previous_status = subscription.status if subscription else None

        status = SubscriptionStatus.active
        current_period_start = utc_now()
        trial_start: datetime | None = None
        trial_end = checkout.trial_end
        if trial_end is not None:
            status = SubscriptionStatus.trialing
            trial_start = current_period_start
            current_period_end = trial_end
        else:
            current_period_end = recurring_interval.get_next_period(
                current_period_start, recurring_interval_count
            )

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
        subscription.trial_start = trial_start
        subscription.trial_end = trial_end

        subscription.recurring_interval = recurring_interval
        subscription.recurring_interval_count = recurring_interval_count
        subscription.status = status
        subscription.payment_method = payment_method
        subscription.product = product
        subscription.subscription_product_prices = subscription_product_prices
        subscription.currency = currency
        subscription.discount = checkout.discount
        # For non-trial checkouts with a discount, the discount is applied immediately
        # (the first payment at checkout includes the discount)
        if checkout.discount is not None and trial_end is None:
            subscription.discount_applied_at = current_period_start
        subscription.checkout = checkout
        subscription.user_metadata = checkout.user_metadata
        subscription.custom_field_data = checkout.custom_field_data
        subscription.seats = checkout.seats

        repository = SubscriptionRepository.from_session(session)
        if created:
            subscription = await repository.create(subscription, flush=True)
            await self._after_subscription_created(session, subscription)
            # ⚠️ Some users are relying on `subscription.updated` for everything
            # It was working before with Stripe since it always triggered an update
            # after creation.
            # But that's not the case with our new engine.
            # So we manually trigger it here to keep the same behavior.
            await self._on_subscription_updated(session, subscription)

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

    async def cycle(
        self,
        session: AsyncSession,
        subscription: Subscription,
        update_cycle_dates: bool = True,
    ) -> Subscription:
        if not subscription.active:
            raise InactiveSubscription(subscription)

        revoke = subscription.cancel_at_period_end
        previous_status = subscription.status
        previous_canceled = subscription.canceled

        # Subscription is due to cancel, revoke it
        if revoke:
            subscription.ended_at = utc_now()
            subscription.status = SubscriptionStatus.canceled
            await self.enqueue_benefits_grants(session, subscription)
        # Normal cycle
        else:
            if update_cycle_dates:
                current_period_end = subscription.current_period_end
                subscription.current_period_start = current_period_end
                subscription.current_period_end = (
                    subscription.recurring_interval.get_next_period(
                        current_period_end, subscription.recurring_interval_count
                    )
                )

            # Check if discount is still applicable
            if subscription.discount is not None:
                # Set discount_applied_at on first use (when discount is actually applied to a cycle)
                if subscription.discount_applied_at is None:
                    subscription.discount_applied_at = subscription.current_period_start

                if subscription.discount.is_repetition_expired(
                    subscription.discount_applied_at,
                    subscription.current_period_start,
                ):
                    subscription.discount = None

            event = event = await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.subscription_cycled,
                    customer=subscription.customer,
                    organization=subscription.organization,
                    metadata=SubscriptionCycledMetadata(
                        subscription_id=str(subscription.id),
                        product_id=str(subscription.product_id),
                        amount=subscription.amount,
                        currency=subscription.currency,
                        recurring_interval=subscription.recurring_interval.value,
                        recurring_interval_count=subscription.recurring_interval_count,
                    ),
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
                            subscription_product_price.amount, subscription.currency
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

        if previous_status == SubscriptionStatus.trialing:
            subscription.status = SubscriptionStatus.active

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(
            subscription, update_dict={"scheduler_locked_at": None}
        )

        billing_reason = (
            OrderBillingReasonInternal.subscription_cycle_after_trial
            if previous_status == SubscriptionStatus.trialing
            else OrderBillingReasonInternal.subscription_cycle
        )
        enqueue_job(
            "order.create_subscription_order",
            subscription.id,
            billing_reason,
        )

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_canceled,
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

        assert subscription.started_at is not None
        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_created,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=SubscriptionCreatedMetadata(
                    subscription_id=str(subscription.id),
                    product_id=str(subscription.product_id),
                    amount=subscription.amount,
                    currency=subscription.currency,
                    recurring_interval=subscription.recurring_interval.value,
                    recurring_interval_count=subscription.recurring_interval_count,
                    started_at=subscription.started_at.isoformat(),
                ),
            ),
        )

        # ⚠️ In some cases, the subscription is immediately active
        # Make sure then to perform all the operations required!
        if subscription.active:
            await self._on_subscription_activated(session, subscription, False)

        enqueue_job("customer.state_changed", subscription.customer_id)

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
            return await self.update_product(
                session,
                subscription,
                product_id=update.product_id,
                proration_behavior=update.proration_behavior,
            )

        if isinstance(update, SubscriptionUpdateDiscount):
            return await self.update_discount(
                session,
                subscription,
                discount_id=update.discount_id,
            )

        if isinstance(update, SubscriptionUpdateTrial):
            return await self.update_trial(
                session, subscription, trial_end=update.trial_end
            )

        if isinstance(update, SubscriptionUpdateSeats):
            return await self.update_seats(
                session,
                subscription,
                seats=update.seats,
                proration_behavior=update.proration_behavior,
            )

        if isinstance(update, SubscriptionUpdateBillingPeriod):
            return await self.update_currrent_billing_period_end(
                session,
                subscription,
                new_period_end=update.current_billing_period_end,
            )

        if isinstance(update, SubscriptionCancel):
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
        allowed_visibilities: frozenset[ProductVisibility] = frozenset(
            ProductVisibility
        ),
    ) -> Subscription:
        if subscription.revoked or subscription.cancel_at_period_end:
            raise AlreadyCanceledSubscription(subscription)

        if subscription.trialing:
            raise TrialingSubscription(subscription)

        previous_product = subscription.product
        previous_status = subscription.status
        previous_is_canceled = subscription.canceled
        previous_prices = [*subscription.prices]

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

        if product.visibility not in allowed_visibilities:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product visibility is not allowed.",
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

        try:
            currency_prices = PriceSet.from_product(product, subscription.currency)
        except NoPricesForCurrencies as e:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "This product doesn't have a price for the subscription currency.",
                        "input": product_id,
                    }
                ]
            ) from e

        for price in currency_prices:
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

        old_has_seat_prices = any(is_seat_price(p) for p in previous_prices)
        new_has_seat_prices = any(is_seat_price(p) for p in currency_prices)
        if old_has_seat_prices != new_has_seat_prices:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Can't switch between seat-based and non-seat-based products.",
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

        assert is_recurring_product(product)
        assert is_recurring_product(previous_product)

        subscription_update, billing_entries = generate_subscription_update(
            subscription, product=product
        )
        for entry in billing_entries:
            entry.event = event
            session.add(entry)

        interval_changed = subscription_update.is_interval_changed()

        subscription = subscription_update.apply_update()
        session.add(subscription)
        await session.flush()

        if proration_behavior is None:
            proration_behavior = organization.proration_behavior

        if (
            proration_behavior == SubscriptionProrationBehavior.invoice
            or interval_changed
        ):
            # Invoice and attempt to pay immediately
            await self._create_subscription_update_order(session, subscription)
        elif proration_behavior == SubscriptionProrationBehavior.prorate:
            # Add prorations to next invoice
            pass

        await self.enqueue_benefits_grants(session, subscription)

        # Send product change email notification
        await self.send_subscription_updated_email(
            session, subscription, product, proration_behavior
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
            repository = SubscriptionRepository.from_session(session)
            return await repository.update(
                subscription, update_dict={"discount": discount}, flush=True
            )

        if discount is None:
            return await _update_discount(session, subscription, None)

        async with discount_service.redeem_discount(
            session, discount
        ) as discount_redemption:
            discount_redemption.subscription = subscription
            return await _update_discount(session, subscription, discount)

    async def update_trial(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        trial_end: datetime | Literal["now"],
    ) -> Subscription:
        if not subscription.active:
            raise InactiveSubscription(subscription)

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        # Already trialing
        if subscription.trialing:
            # End trial immediately
            if trial_end == "now":
                subscription.trial_end = subscription.current_period_end = utc_now()
                # Make sure to cycle the subscription immediately to update status and trigger order
                subscription = await self.cycle(session, subscription)
            # Set new trial end date
            else:
                subscription.trial_end = subscription.current_period_end = cast(
                    datetime, trial_end
                )
        # Active subscription
        else:
            # Can't end trial if not trialing
            if trial_end == "now":
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "trial_end"),
                            "msg": "The subscription is not currently trialing.",
                            "input": trial_end,
                        }
                    ]
                )
            # Set a new trial
            else:
                trial_end_datetime = cast(datetime, trial_end)
                # Ensure trial_end is after current_period_end to prevent customer loss
                if trial_end_datetime <= subscription.current_period_end:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "trial_end"),
                                "msg": "Trial end must be after the current period end.",
                                "input": trial_end_datetime,
                            }
                        ]
                    )
                subscription.status = SubscriptionStatus.trialing
                subscription.trial_end = subscription.current_period_end = (
                    trial_end_datetime
                )

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(subscription)

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )

        return subscription

    async def update_seats(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        seats: int,
        proration_behavior: SubscriptionProrationBehavior | None = None,
    ) -> Subscription:
        """
        Update the number of seats for a seat-based subscription.

        Validates:
        - Subscription is seat-based
        - Subscription is active
        - New seat count >= minimum seats
        - New seat count <= maximum seats (if set)
        - New seat count >= currently assigned seats
        """
        if subscription.revoked or subscription.cancel_at_period_end:
            raise AlreadyCanceledSubscription(subscription)

        seat_price = subscription.get_price_by_type(ProductPriceSeatUnit)
        if seat_price is None:
            raise NotASeatBasedSubscription(subscription)

        minimum_seats = seat_price.get_minimum_seats()
        if seats < minimum_seats:
            raise BelowMinimumSeats(subscription, minimum_seats, seats)

        maximum_seats = seat_price.get_maximum_seats()
        if maximum_seats is not None and seats > maximum_seats:
            raise AboveMaximumSeats(subscription, maximum_seats, seats)

        assigned_count = await seat_service.count_assigned_seats_for_subscription(
            session, subscription
        )

        if seats < assigned_count:
            raise SeatsAlreadyAssigned(subscription, assigned_count, seats)

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            subscription.product.organization_id
        )
        assert organization is not None

        if proration_behavior is None:
            proration_behavior = organization.proration_behavior

        old_seats = subscription.seats or 1
        old_amount = subscription.amount

        event = await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_seats_updated,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata={
                    "subscription_id": str(subscription.id),
                    "old_seats": old_seats,
                    "new_seats": seats,
                    "proration_behavior": proration_behavior.value,
                },
            ),
        )

        subscription_update, billing_entries = generate_subscription_update(
            subscription, seats=seats
        )

        # Skip proration for trialing subscriptions - no billing during trial
        if not subscription.trialing:
            for entry in billing_entries:
                entry.event = event
                session.add(entry)

        subscription = subscription_update.apply_update()
        session.add(subscription)
        await session.flush()

        log.info(
            "subscription.seats_updated",
            subscription_id=subscription.id,
            old_seats=old_seats,
            new_seats=seats,
            old_amount=old_amount,
            new_amount=subscription.amount,
        )

        # Send webhooks and notifications
        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )

        if proration_behavior == SubscriptionProrationBehavior.invoice:
            # Invoice and attempt to pay immediately
            await self._create_subscription_update_order(session, subscription)

        return subscription

    async def update_currrent_billing_period_end(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        new_period_end: datetime,
    ) -> Subscription:
        if subscription.revoked:
            raise AlreadyCanceledSubscription(subscription)

        if not subscription.active:
            raise InactiveSubscription(subscription)

        if subscription.cancel_at_period_end:
            raise AlreadyCanceledSubscription(subscription)

        if new_period_end < subscription.current_period_end:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "current_billing_period_end"),
                        "msg": "New period end is earlier than the current period end",
                        "input": new_period_end,
                    }
                ]
            )

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled
        old_period_end = subscription.current_period_end

        subscription.current_period_end = new_period_end

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_billing_period_updated,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata={
                    "subscription_id": str(subscription.id),
                    "old_period_end": old_period_end.isoformat(),
                    "new_period_end": new_period_end.isoformat(),
                },
            ),
        )

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(subscription)

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )

        return subscription

    async def uncancel(
        self, session: AsyncSession, subscription: Subscription
    ) -> Subscription:
        if subscription.ended_at:
            raise ResourceUnavailable()

        if not (
            subscription.status in SubscriptionStatus.billable_statuses()
            and subscription.cancel_at_period_end
        ):
            raise BadRequest()

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled

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
            await self._perform_cancellation(
                session,
                subscription,
                immediately=True,
                # Benefits are revoked through `benefit.revoke_customer`
                revoke_benefits=False,
            )

    async def _perform_cancellation(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
        immediately: bool = False,
        revoke_benefits: bool = True,
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

        if immediately:
            subscription.ends_at = now
            subscription.ended_at = now
            subscription.status = SubscriptionStatus.canceled
            if revoke_benefits:
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

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_is_canceled=previous_is_canceled,
        )
        return subscription

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

    async def calculate_charge_preview(
        self, session: AsyncSession, subscription: Subscription
    ) -> SubscriptionChargePreview:
        """
        Calculate a preview of the next charge for a subscription.

        Args:
            session: Database session
            subscription: The subscription to calculate the preview for

        Returns:
            SubscriptionChargePreview with breakdown of charges
        """
        # If subscription is set to cancel at period end, there's no base charge
        # Only metered charges accumulated during the period will be billed
        if subscription.cancel_at_period_end or subscription.ends_at:
            base_price = 0
        else:
            base_price = sum(p.amount for p in subscription.subscription_product_prices)

        metered_amount = sum(meter.amount for meter in subscription.meters)

        subtotal_amount = base_price + metered_amount

        discount_amount = 0

        applicable_discount = None

        # Ensure the discount has not expired yet for the next charge (so at current_period_end)
        if subscription.discount is not None:
            # If discount hasn't been applied yet, it will be applied at the next cycle
            # (current_period_end will become the new current_period_start)
            discount_applied_at = (
                subscription.discount_applied_at or subscription.current_period_end
            )
            if not subscription.discount.is_repetition_expired(
                discount_applied_at,
                subscription.current_period_end,
            ):
                applicable_discount = subscription.discount

        if applicable_discount is not None:
            discount_amount = applicable_discount.get_discount_amount(
                subtotal_amount, subscription.currency
            )

        taxable_amount = subtotal_amount - discount_amount

        tax_amount = 0

        if (
            taxable_amount > 0
            and subscription.product.is_tax_applicable
            and subscription.customer.billing_address is not None
        ):
            try:
                tax, _ = await tax_calculation_service.calculate(
                    subscription.id,
                    subscription.currency,
                    taxable_amount,
                    subscription.product.tax_code,
                    subscription.customer.billing_address,
                    [subscription.customer.tax_id]
                    if subscription.customer.tax_id is not None
                    else [],
                    subscription.tax_exempted,
                )
            except TaxCalculationLogicalError:
                log.warning(
                    "Failed to calculate tax for subscription due to invalid or incomplete address",
                    subscription_id=subscription.id,
                    customer_id=subscription.customer_id,
                )
                tax_amount = 0
            else:
                tax_amount = tax["amount"]

        total = taxable_amount + tax_amount

        return SubscriptionChargePreview(
            base_amount=base_price,
            metered_amount=metered_amount,
            subtotal_amount=subtotal_amount,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total_amount=total,
        )

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

        if became_canceled or (became_revoked and previous_is_canceled):
            await self._on_subscription_canceled(
                session, subscription, revoked=became_revoked
            )

        if became_revoked:
            await self._on_subscription_revoked(
                session, subscription, past_due=became_past_due
            )

        enqueue_job("customer.state_changed", subscription.customer_id)

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

        # Only send merchant notification if the subscription is a new one,
        # not a past due that has been reactivated.
        if not reactivated:
            await self._send_new_subscription_notification(session, subscription)

    async def _on_subscription_past_due(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_past_due
        )
        await self.send_past_due_email(session, subscription)

    async def _on_subscription_uncanceled(
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_uncanceled
        )

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_uncanceled,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=SubscriptionUncanceledMetadata(
                    subscription_id=str(subscription.id),
                    product_id=str(subscription.product_id),
                    amount=subscription.amount,
                    currency=subscription.currency,
                    recurring_interval=subscription.recurring_interval.value,
                    recurring_interval_count=subscription.recurring_interval_count,
                ),
            ),
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

        assert subscription.canceled_at is not None
        metadata = SubscriptionCanceledMetadata(
            subscription_id=str(subscription.id),
            product_id=str(subscription.product_id),
            amount=subscription.amount,
            currency=subscription.currency,
            recurring_interval=subscription.recurring_interval.value,
            recurring_interval_count=subscription.recurring_interval_count,
            canceled_at=subscription.canceled_at.isoformat(),
        )
        if subscription.customer_cancellation_reason is not None:
            metadata["customer_cancellation_reason"] = (
                subscription.customer_cancellation_reason
            )
        if subscription.customer_cancellation_comment is not None:
            metadata["customer_cancellation_comment"] = (
                subscription.customer_cancellation_comment
            )
        if subscription.ends_at is not None:
            metadata["ends_at"] = subscription.ends_at.isoformat()
        metadata["cancel_at_period_end"] = subscription.cancel_at_period_end

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_canceled,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=metadata,
            ),
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

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_revoked,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=SubscriptionRevokedMetadata(
                    subscription_id=str(subscription.id),
                    product_id=str(subscription.product_id),
                    amount=subscription.amount,
                    currency=subscription.currency,
                    recurring_interval=subscription.recurring_interval.value,
                    recurring_interval_count=subscription.recurring_interval_count,
                ),
            ),
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
                        tier_organization_name=product.organization.name,
                        tier_organization_slug=product.organization.slug,
                        subscription_id=str(subscription.id),
                        currency=subscription.currency,
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
            WebhookEventType.subscription_past_due,
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

    async def _is_within_revocation_grace_period(
        self,
        session: AsyncSession,
        subscription: Subscription,
        organization: Organization,
    ) -> bool:
        """Check if a subscription is within its benefit revocation grace period.

        Returns True if within grace period (benefits should not be revoked yet).
        Returns False if grace period has expired or doesn't apply.
        """
        if subscription.status not in {
            SubscriptionStatus.past_due,
            SubscriptionStatus.unpaid,
        }:
            return False

        grace_period_days = int(organization.benefit_revocation_grace_period)

        if grace_period_days == 0:
            return False

        if not subscription.past_due_at:
            return False

        grace_period_ends_at = subscription.past_due_at + timedelta(
            days=grace_period_days
        )
        now = utc_now()

        if now < grace_period_ends_at:
            log.info(
                "Subscription is within benefit revocation grace period",
                subscription_id=str(subscription.id),
                customer_id=str(subscription.customer_id),
                past_due_at=subscription.past_due_at.isoformat(),
                grace_period_ends_at=grace_period_ends_at.isoformat(),
                days_remaining=(grace_period_ends_at - now).days,
            )
            return True

        return False

    async def enqueue_benefits_grants(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        delay: int | None = None,
    ) -> None:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(subscription.product_id)
        assert product is not None

        if subscription.is_incomplete():
            return

        task = "grant" if subscription.active else "revoke"

        # Check grace period for benefit revocation
        if task == "revoke":
            organization_repository = OrganizationRepository.from_session(session)
            organization = await organization_repository.get_by_id(
                product.organization_id,
                include_deleted=True,
                include_blocked=True,
            )
            assert organization is not None

            if await self._is_within_revocation_grace_period(
                session, subscription, organization
            ):
                # Don't enqueue revocation yet, still within grace period
                return

        # For seat-based products, handle benefits through seats
        if product.has_seat_based_price:
            # When subscription is cancelled/revoked, revoke all seats
            # which will in turn revoke benefits for each seat holder
            if not subscription.active:
                await seat_service.revoke_all_seats_for_subscription(
                    session, subscription
                )
            # When subscription is active, benefits are granted when seats are claimed
            # So we don't need to do anything here
            return

        enqueue_job(
            "benefit.enqueue_benefits_grants",
            task=task,
            customer_id=subscription.customer_id,
            product_id=product.id,
            subscription_id=subscription.id,
            delay=delay,
        )

    async def update_product_benefits_grants(
        self, session: AsyncSession, product: Product
    ) -> None:
        base_statement = select(Subscription).where(
            Subscription.product_id == product.id, Subscription.is_deleted.is_(False)
        )

        count_result = await session.execute(
            base_statement.with_only_columns(func.count())
        )
        total_count = count_result.scalar_one()
        calculate_delay = make_bulk_job_delay_calculator(total_count)

        subscriptions = await session.stream_scalars(
            base_statement,
            execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
        )
        index = 0
        async for subscription in subscriptions:
            await self.enqueue_benefits_grants(
                session,
                subscription,
                delay=calculate_delay(index),
            )
            index += 1

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
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription payment is past due",
            template_name="subscription_past_due",
        )

    async def send_subscription_updated_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        new_product: Product,
        proration_behavior: SubscriptionProrationBehavior,
    ) -> None:
        # Don't send email if invoicing immediately
        # It'll be sent after the Order has been created
        if proration_behavior == SubscriptionProrationBehavior.invoice:
            return

        subject = f"Your subscription has changed to {new_product.name}"

        return await self._send_customer_email(
            session,
            subscription,
            subject_template=subject,
            template_name="subscription_updated",
            extra_context={
                "order": None,
            },
        )

    async def _send_customer_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        subject_template: str,
        template_name: Literal[
            "subscription_cancellation",
            "subscription_past_due",
            "subscription_revoked",
            "subscription_uncanceled",
            "subscription_updated",
        ],
        extra_context: dict[str, Any] | None = None,
    ) -> None:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(
            subscription.product_id, options=product_repository.get_eager_options()
        )
        assert product is not None
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

        if not organization.customer_email_settings[template_name]:
            return

        customer = subscription.customer
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        # Build query parameters with proper URL encoding
        query_string = urlencode(
            {
                "customer_session_token": token,
                "id": str(subscription.id),
                "email": customer.email,
            }
        )
        portal_url = settings.generate_frontend_url(
            f"/{organization.slug}/portal?{query_string}"
        )

        email = EmailAdapter.validate_python(
            {
                "template": template_name,
                "props": {
                    "email": subscription.customer.email,
                    "organization": organization,
                    "product": product,
                    "subscription": subscription,
                    "url": portal_url,
                    **(extra_context or {}),
                },
            }
        )

        subject = subject_template.format(product=product)

        enqueue_email_template(
            email,
            **organization.email_from_reply,
            to_email_addr=subscription.customer.email,
            subject=subject,
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
            BenefitGrant.is_deleted.is_(False),
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
        update_dict: dict[str, Any] = {"status": SubscriptionStatus.past_due}
        if subscription.past_due_at is None:
            update_dict["past_due_at"] = utc_now()
        subscription = await repository.update(subscription, update_dict=update_dict)

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
            subscription,
            update_dict={"status": SubscriptionStatus.active, "past_due_at": None},
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
        """
        subscription.payment_method = payment_method
        repository = SubscriptionRepository.from_session(session)
        return await repository.update(subscription)

    async def _create_subscription_update_order(
        self, session: AsyncSession, subscription: Subscription
    ) -> Order:
        from polar.order.service import order as order_service

        return await order_service.create_subscription_order(
            session,
            subscription,
            OrderBillingReasonInternal.subscription_update,
            payment_mode=PaymentMode.sync,
        )


subscription = SubscriptionService()
