import contextlib
import uuid
from collections.abc import AsyncGenerator, Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import TracebackType
from typing import Any, Literal, Unpack, cast, overload
from urllib.parse import urlencode

import structlog
from sqlalchemy import select
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_resource_permission
from polar.authz.types import AccessibleOrganizationID
from polar.billing_entry.repository import BillingEntryRepository
from polar.billing_entry.service import MeteredLineItem
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.guard import has_product_checkout
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.customer_meter.service import customer_meter as customer_meter_service
from polar.customer_seat.service import seat_service
from polar.discount.repository import DiscountRedemptionRepository, DiscountRepository
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
    SubscriptionPastDueMetadata,
    SubscriptionPausedMetadata,
    SubscriptionReactivatedMetadata,
    SubscriptionResumedMetadata,
    SubscriptionRevokedMetadata,
    SubscriptionUncanceledMetadata,
    SubscriptionUpdatedMetadataFields,
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
from polar.kit.visibility import Visibility
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
from polar.models.product_price import ProductPrice, ProductPriceSeatUnit
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerNewPaidSubscriptionNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.order.amounts import LineItem, compute_order_amounts
from polar.organization.repository import (
    SUBSCRIPTION_CANCELLATION_STATUSES,
    OrganizationRepository,
)
from polar.product.guard import (
    is_custom_price,
    is_recurring_product,
    is_seat_price,
    is_static_price,
)
from polar.product.price_set import NoPricesForCurrencies, PriceSet
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job, make_bulk_job_delay_calculator

from .repository import SubscriptionRepository, SubscriptionUpdateRepository
from .schemas import (
    SubscriptionCancel,
    SubscriptionChargePreview,
    SubscriptionChargePreviewProration,
    SubscriptionCreate,
    SubscriptionCreateCustomer,
    SubscriptionPause,
    SubscriptionResume,
    SubscriptionRevoke,
    SubscriptionUpdate,
    SubscriptionUpdateBase,
    SubscriptionUpdateBillingPeriod,
    SubscriptionUpdateClear,
    SubscriptionUpdateSeats,
)
from .sorting import SubscriptionSortProperty
from .update import generate_subscription_update

log: Logger = structlog.get_logger()

SUBSCRIPTION_CANCELLATION_BATCH_SIZE = 50
"""Max subscriptions cancelled per ``cancel_for_organization`` job, so a large
merchant winds down across several short jobs that each stay under the worker's
60s time limit."""


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


class SubscriptionLocked(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is pending an update."
        super().__init__(message, 409)


class CannotPauseSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription cannot be paused."
        super().__init__(message, 409)


class NoScheduledPause(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is not scheduled to be paused."
        super().__init__(message, 409)


class NotPausedSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is not paused."
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


class SubscriptionUpdateContext:
    """Async context manager for batching subscription update side effects.

    Centralizes the execution of side effects (webhooks, events, billing actions)
    to ensure they are triggered exactly once, even when multiple update operations
    are performed together.
    """

    def __init__(
        self,
        session: AsyncSession,
        subscription: Subscription,
        service: "SubscriptionService",
        *,
        notify_customer: bool = True,
    ) -> None:
        self.session = session
        self.service = service

        self.subscription = subscription
        self._previous_status = subscription.status
        self._previous_is_canceled = subscription.canceled
        self._notify_customer = notify_customer

        self._billing_effect: Literal["invoice", "cycle"] | None = None
        self._event_metadata: SubscriptionUpdatedMetadataFields = {}

    async def __aenter__(self) -> "SubscriptionUpdateContext":
        return self

    async def __aexit__(
        self,
        type_: type[BaseException] | None,
        value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        # Don't trigger side effects if an exception was raised within the context
        if value is not None:
            return

        match self._billing_effect:
            case "cycle":
                await self.service.cycle(self.session, self, self.subscription)
            case "invoice":
                await self.service._create_subscription_update_order(
                    self.session, self.subscription
                )

        if self._event_metadata:
            await event_service.create_event(
                self.session,
                build_system_event(
                    SystemEvent.subscription_updated,
                    customer=self.subscription.customer,
                    organization=self.subscription.organization,
                    metadata={
                        "subscription_id": str(self.subscription.id),
                        **self._event_metadata,
                    },
                ),
            )

        await self.service._after_subscription_updated(
            self.session,
            self.subscription,
            previous_status=self._previous_status,
            previous_is_canceled=self._previous_is_canceled,
            notify_customer=self._notify_customer,
        )

    def set_billing_effect(self, effect: Literal["invoice", "cycle"]) -> None:
        if effect == "cycle":
            self._billing_effect = "cycle"
        elif effect == "invoice" and self._billing_effect != "cycle":
            self._billing_effect = "invoice"

    def add_event_metadata(
        self, **metadata: Unpack[SubscriptionUpdatedMetadataFields]
    ) -> None:
        self._event_metadata.update(metadata)


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
        status: Sequence[SubscriptionStatus] | None = None,
        cancel_at_period_end: bool | None = None,
        customer_cancellation_reason: Sequence[CustomerCancellationReason]
        | None = None,
        canceled_at_after: datetime | None = None,
        canceled_at_before: datetime | None = None,
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
            .join(Subscription.product)
            .join(Subscription.customer)
            .join(Subscription.discount, isouter=True)
        )

        if organization_id is not None:
            statement = statement.where(
                Subscription.organization_id.in_(organization_id)
            )

        if product_id is not None:
            statement = statement.where(Subscription.product_id.in_(product_id))

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

        if status is not None:
            statement = statement.where(Subscription.status.in_(status))

        if cancel_at_period_end is not None:
            statement = statement.where(
                Subscription.cancel_at_period_end.is_(cancel_at_period_end)
            )

        if customer_cancellation_reason is not None:
            statement = statement.where(
                Subscription.customer_cancellation_reason.in_(
                    customer_cancellation_reason
                )
            )

        if canceled_at_after is not None:
            statement = statement.where(Subscription.canceled_at >= canceled_at_after)

        if canceled_at_before is not None:
            statement = statement.where(Subscription.canceled_at <= canceled_at_before)

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
            joinedload(Subscription.pending_update),
        )

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
        *,
        for_update: bool = False,
    ) -> Subscription | None:
        repository = SubscriptionRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(
                Subscription.id == id,
                Subscription.started_at.is_not(None),
            )
            .options(*repository.get_eager_options())
        )

        if for_update:
            statement = statement.with_for_update(of=Subscription)

        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        subscription_create: SubscriptionCreate,
        auth_subject: AuthSubject[User | Organization],
        *,
        created_at: datetime | None = None,
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
        ) and not default_price.is_free:
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

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        assert product is not None

        await assert_resource_permission(
            session, auth_subject, product, OrganizationPermission.customers_manage
        )

        # Scope the customer lookup to the product's own org so a caller with
        # `customers:manage` on the product's org can't pair it with a customer
        # belonging to another org they happen to also be a member of.
        customer_repository = CustomerRepository.from_session(session)
        product_org_ids = {AccessibleOrganizationID(product.organization_id)}
        error_loc: str
        input_value: uuid.UUID | str
        customer: Customer | None
        if isinstance(subscription_create, SubscriptionCreateCustomer):
            error_loc = "customer_id"
            input_value = subscription_create.customer_id
            customer = await customer_repository.get_readable_by_id(
                product_org_ids, input_value
            )
        else:
            error_loc = "external_customer_id"
            input_value = subscription_create.external_customer_id
            customer = await customer_repository.get_readable_by_external_id(
                product_org_ids, input_value
            )

        if customer is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", error_loc),
                        "msg": "Customer does not exist.",
                        "input": input_value,
                    }
                ]
            )

        assert is_recurring_product(product)
        recurring_interval = product.recurring_interval
        recurring_interval_count = product.recurring_interval_count

        currency = product.organization.default_presentment_currency
        currency_prices = PriceSet.from_product(product, currency)

        # For seat-based products, determine initial seats from the price tiers
        seats: int | None = None
        if product.has_seat_based_price:
            for p in currency_prices:
                if is_seat_price(p):
                    seats = p.get_minimum_seats()
                    break

        subscription_product_prices: list[SubscriptionProductPrice] = []
        for price in currency_prices:
            subscription_product_prices.append(
                SubscriptionProductPrice.from_price(price, seats=seats)
            )

        current_period_start = utc_now()
        current_period_end = recurring_interval.get_next_period(
            current_period_start, current_period_start.day, recurring_interval_count
        )
        anchor_day = current_period_start.day

        subscription = Subscription(
            status=SubscriptionStatus.active,
            started_at=current_period_start,
            anchor_day=anchor_day,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            cancel_at_period_end=False,
            recurring_interval=recurring_interval,
            recurring_interval_count=recurring_interval_count,
            meter_interval=product.meter_interval,
            meter_interval_count=product.meter_interval_count,
            organization=product.organization,
            product=product,
            customer=customer,
            subscription_product_prices=subscription_product_prices,
            currency=currency,
            seats=seats,
            user_metadata=subscription_create.metadata,
            pending_update=None,
        )
        subscription.initialize_meter_period(current_period_start)
        if created_at is not None:
            subscription.created_at = created_at

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.create(subscription, flush=True)

        # Auto-upgrade customer to 'team' type when subscribing to a seat-based product
        if product.has_seat_based_price:
            await customer_service.upgrade_to_team(session, customer)

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
                current_period_start, current_period_start.day, recurring_interval_count
            )

        # New subscription
        if subscription is None:
            subscription = Subscription(
                started_at=current_period_start,
                cancel_at_period_end=False,
                customer=customer,
                pending_update=None,
            )
            created = True

        # Even when updating from a free subscription, we change the current period:
        # we start a billing cycle from the checkout date.
        subscription.current_period_start = current_period_start
        subscription.current_period_end = current_period_end
        subscription.trial_start = trial_start
        subscription.trial_end = trial_end
        subscription.anchor_day = current_period_start.day

        subscription.recurring_interval = recurring_interval
        subscription.recurring_interval_count = recurring_interval_count
        subscription.meter_interval = product.meter_interval
        subscription.meter_interval_count = product.meter_interval_count
        subscription.initialize_meter_period(
            None if trial_end is not None else current_period_start
        )
        subscription.status = status
        subscription.payment_method = payment_method
        subscription.organization = checkout.organization
        subscription.product = product
        subscription.subscription_product_prices = subscription_product_prices
        subscription.currency = currency
        subscription.tax_behavior = checkout.tax_behavior
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

        # Auto-upgrade customer to 'team' type when subscribing to a seat-based product
        if product.has_seat_based_price:
            await customer_service.upgrade_to_team(session, customer)

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
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        update_cycle_dates: bool = True,
    ) -> Subscription:
        if not subscription.active:
            raise InactiveSubscription(subscription)

        # Defensive: capability may have flipped off between scheduler
        # pick-up and task execution.
        if not subscription.organization.can_renew_subscriptions:
            log.info(
                "Subscription renewals disabled for organization, skipping cycle",
                subscription_id=subscription.id,
                organization_id=subscription.organization.id,
            )
            return subscription

        revoke = subscription.cancel_at_period_end

        # Subscription is due to pause: it enters the paused state at the end of
        # its current period instead of renewing. Benefits are revoked and no
        # order is created; a scheduled or manual resume starts a new period. A
        # scheduled cancellation takes precedence over a scheduled pause.
        if not revoke and subscription.pause_at_period_end:
            subscription.status = SubscriptionStatus.paused
            subscription.paused_at = utc_now()
            subscription.pause_at_period_end = False
            await self.enqueue_benefits_grants(session, subscription)
            repository = SubscriptionRepository.from_session(session)
            return await repository.update(
                subscription, update_dict={"scheduler_locked_at": None}
            )

        previous_status = subscription.status
        previous_canceled = subscription.canceled

        # Subscription is due to cancel, revoke it
        if revoke:
            subscription.ended_at = utc_now()
            subscription.status = SubscriptionStatus.canceled
            await self.enqueue_benefits_grants(session, subscription)
        # Normal cycle
        else:
            # Apply any pending subscription update (product change, seats change)
            # scheduled for the beginning of this new cycle
            pending_update = subscription.pending_update
            pending_update_changed_interval = False
            if pending_update is not None:
                pending_update.subscription = subscription
                if pending_update.product_id is not None:
                    product_repository = ProductRepository.from_session(session)
                    pending_update.product = await product_repository.get_by_id(
                        pending_update.product_id,
                        options=product_repository.get_eager_options(),
                    )
                else:
                    pending_update.product = None
                if pending_update.discount_id is not None:
                    discount_repository = DiscountRepository.from_session(session)
                    pending_update.discount = await discount_repository.get_by_id(
                        pending_update.discount_id
                    )
                else:
                    pending_update.discount = None
                subscription_update_repository = (
                    SubscriptionUpdateRepository.from_session(session)
                )
                # Check before apply_update() changes subscription.product
                pending_update_changed_interval = pending_update.is_interval_changed()
                try:
                    pending_update.apply_update()
                except NoPricesForCurrencies:
                    # The target product's prices in the subscription's currency
                    # were archived after this update was scheduled. Discard the
                    # stale update and cycle on the current product rather than
                    # leaving the subscription permanently locked.
                    log.warning(
                        "Skipping scheduled subscription update: "
                        "target product has no price for the subscription currency",
                        subscription_id=subscription.id,
                        subscription_update_id=pending_update.id,
                        product_id=pending_update.product_id,
                        currency=subscription.currency,
                    )
                    pending_update_changed_interval = False
                    await subscription_update_repository.soft_delete(pending_update)
                else:
                    await subscription_update_repository.update(pending_update)
                subscription.pending_update = None

            if update_cycle_dates and not pending_update_changed_interval:
                current_period_end = subscription.current_period_end
                subscription.current_period_start = current_period_end
                if previous_status == SubscriptionStatus.trialing:
                    subscription.anchor_day = current_period_end.day
                subscription.current_period_end = (
                    subscription.recurring_interval.get_next_period(
                        current_period_end,
                        subscription.anchor_day,
                        subscription.recurring_interval_count,
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

            await self._create_cycle_billing_entries(session, subscription)

        if previous_status == SubscriptionStatus.trialing:
            subscription.status = SubscriptionStatus.active

        # Re-arm the meter clock off the new billing period. At the billing boundary
        # both clocks coincide, so the full cycle settles the final meter period and
        # the meter clock simply restarts. Also covers trial conversion, where the
        # meter clock starts for the first time.
        if not revoke:
            subscription.initialize_meter_period(subscription.current_period_start)

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(
            subscription, update_dict={"scheduler_locked_at": None}
        )

        if revoke:
            billing_reason = OrderBillingReasonInternal.subscription_cancel
        elif previous_status == SubscriptionStatus.trialing:
            billing_reason = OrderBillingReasonInternal.subscription_cycle_after_trial
        else:
            billing_reason = OrderBillingReasonInternal.subscription_cycle

        enqueue_job(
            "order.create_subscription_order",
            subscription.id,
            billing_reason,
        )

        return subscription

    async def _create_cycle_billing_entries(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        event = await event_service.create_event(
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
                timestamp=subscription.created_at,
            ),
        )

        # ⚠️ In some cases, the subscription is immediately active
        # Make sure then to perform all the operations required!
        if subscription.active:
            await self._on_subscription_activated(session, subscription, False)

        enqueue_job("customer.state_changed", subscription.customer_id)

    async def update(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        update: SubscriptionUpdate,
    ) -> Subscription:
        if (
            isinstance(update, SubscriptionUpdateBase) and update.has_product
        ) or isinstance(update, SubscriptionUpdateSeats):
            if update.proration_behavior == SubscriptionProrationBehavior.reset:
                organization = subscription.organization
                if not organization.feature_settings.get(
                    "reset_proration_behavior_enabled"
                ):
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "proration_behavior"),
                                "msg": "The 'reset' proration behavior is not enabled for this organization.",
                                "input": update.proration_behavior,
                            }
                        ]
                    )

        if isinstance(update, SubscriptionUpdateBase):
            if update.has_product:
                assert update.product_id is not None
                subscription = await self.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=update.product_id,
                    proration_behavior=update.proration_behavior,
                    discount=update.discount,
                )
            # Only update discount if product is not being updated,
            # otherwise it will be handled in update_product()
            # with the right timing depending on proration_behavior
            elif update.discount:
                subscription = await self.update_discount(
                    session,
                    ctx,
                    subscription,
                    discount=update.discount,
                )

            if update.has_trial_end:
                assert update.trial_end is not None
                subscription = await self.update_trial(
                    session, ctx, subscription, trial_end=update.trial_end
                )

        if isinstance(update, SubscriptionUpdateSeats):
            subscription = await self.update_seats(
                session,
                ctx,
                subscription,
                seats=update.seats,
                proration_behavior=update.proration_behavior,
            )

        if isinstance(update, SubscriptionUpdateBillingPeriod):
            subscription = await self.update_currrent_billing_period_end(
                session,
                ctx,
                subscription,
                new_period_end=update.current_billing_period_end,
            )

        if isinstance(update, SubscriptionCancel):
            uncancel = update.cancel_at_period_end is False

            if uncancel:
                subscription = await self.uncancel(session, ctx, subscription)
            else:
                subscription = await self.cancel(
                    session,
                    ctx,
                    subscription,
                    customer_reason=update.customer_cancellation_reason,
                    customer_comment=update.customer_cancellation_comment,
                )

        if isinstance(update, SubscriptionRevoke):
            subscription = await self._perform_cancellation(
                session,
                ctx,
                subscription,
                customer_reason=update.customer_cancellation_reason,
                customer_comment=update.customer_cancellation_comment,
                immediately=True,
            )

        if isinstance(update, SubscriptionPause):
            if update.pause_at_period_end:
                subscription = await self.pause(
                    session, ctx, subscription, resumes_at=update.resumes_at
                )
            else:
                subscription = await self.cancel_scheduled_pause(
                    session, ctx, subscription
                )

        if isinstance(update, SubscriptionResume):
            subscription = await self.resume(session, ctx, subscription)

        if isinstance(update, SubscriptionUpdateClear):
            subscription = await self.clear_pending_update(session, ctx, subscription)

        return subscription

    async def validate_product_change(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        product_id: uuid.UUID,
        allowed_visibilities: frozenset[Visibility] = frozenset(Visibility),
    ) -> tuple[Product, PriceSet]:
        if subscription.revoked or subscription.cancel_at_period_end:
            raise AlreadyCanceledSubscription(subscription)

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

        old_has_seat_prices = any(is_seat_price(p) for p in subscription.prices)
        new_has_seat_prices = any(is_seat_price(p) for p in currency_prices)

        # Seat → non-seat plan changes are not yet supported.
        if old_has_seat_prices and not new_has_seat_prices:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Can't switch from a seat-based to a non-seat-based product.",
                        "input": product_id,
                    }
                ]
            )

        return product, currency_prices

    async def validate_seats_change(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        seats: int,
    ) -> None:
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

    async def update_product(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        product_id: uuid.UUID,
        proration_behavior: SubscriptionProrationBehavior | None = None,
        discount: uuid.UUID | Literal["unset"] | None = None,
        allowed_visibilities: frozenset[Visibility] = frozenset(Visibility),
    ) -> Subscription:
        previous_product = subscription.product
        previous_prices = [*subscription.prices]

        product, currency_prices = await self.validate_product_change(
            session,
            subscription,
            product_id=product_id,
            allowed_visibilities=allowed_visibilities,
        )

        old_has_seat_prices = any(is_seat_price(p) for p in previous_prices)
        new_has_seat_prices = any(is_seat_price(p) for p in currency_prices)

        was_trialing = subscription.status == SubscriptionStatus.trialing
        new_trial_end: datetime | None = None
        ends_trial = False
        if was_trialing:
            new_trial_end = self._resolve_trial_end(subscription, product)
            ends_trial = new_trial_end is None

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

        async with self.resolve_discount(
            session, ctx, subscription, discount=discount, product=product
        ) as resolved_discount:
            assert is_recurring_product(product)
            # We are checking for product.is_recurring instead of is_recurring_product
            # because legacy products will have is_recurring but not be of type RecurringProduct
            # which is_recurring_product asserts.
            assert previous_product.is_recurring

            if proration_behavior is None:
                proration_behavior = organization.proration_behavior

            # Non-seat → seat upgrades: promote `subscription.seats` to the new
            # product's first seat-price tier minimum so the proration debit and
            # `apply_update`'s product-branch rebuild both see a valid seat count.
            # Block `next_period` because the post-apply seat auto-claim has to run
            # immediately so the billing customer doesn't lose benefit access.
            is_initial_seat_transition = not old_has_seat_prices and new_has_seat_prices
            if is_initial_seat_transition:
                if proration_behavior == SubscriptionProrationBehavior.next_period:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "proration_behavior"),
                                "msg": "Switching from a non-seat to a seat-based product must apply immediately and can't use the 'next_period' proration behavior.",
                                "input": proration_behavior,
                            }
                        ]
                    )
                for price in currency_prices:
                    if is_seat_price(price):
                        subscription.seats = price.get_minimum_seats()
                        break

            subscription_update_repository = SubscriptionUpdateRepository.from_session(
                session
            )

            subscription_update, billing_entries = generate_subscription_update(
                subscription,
                proration_behavior,
                product=product,
                discount=resolved_discount,
            )
            if proration_behavior == SubscriptionProrationBehavior.next_period:
                subscription.pending_update = (
                    await subscription_update_repository.upsert(subscription_update)
                )
            else:
                await subscription_update_repository.soft_delete_unapplied_by_subscription_id(
                    subscription.id
                )
                subscription.pending_update = None

                # Skip proration for trialing subscriptions - no billing during trial
                if not was_trialing:
                    for entry in billing_entries:
                        entry.event = event
                        session.add(entry)

                interval_changed = subscription_update.is_interval_changed()
                subscription = subscription_update.apply_update()
                if was_trialing:
                    if ends_trial:
                        # End the trial immediately - cycle() below will transition
                        # to active and bill the customer for the new period.
                        subscription.trial_end = subscription.current_period_end = (
                            utc_now()
                        )
                    else:
                        assert new_trial_end is not None
                        subscription.trial_end = new_trial_end
                        subscription.current_period_end = new_trial_end
                session.add(subscription)
                await session.flush()

                if was_trialing and ends_trial:
                    ctx.set_billing_effect("cycle")
                elif (
                    (proration_behavior.is_immediate() or interval_changed)
                    and not was_trialing
                    and billing_entries
                ):
                    ctx.set_billing_effect("invoice")

                # When transitioning from non-seat to seat-based pricing, promote
                # the billing customer to a 'team' customer and claim a seat for
                # them so they keep benefit access immediately after the switch.
                if is_initial_seat_transition:
                    await customer_service.upgrade_to_team(
                        session, subscription.customer
                    )
                    await seat_service.assign_seat(
                        session,
                        subscription,
                        customer_id=subscription.customer_id,
                        immediate_claim=True,
                    )

                await self.enqueue_benefits_grants(session, subscription)

                # Seat-based subscriptions short-circuit enqueue_benefits_grants
                # while active, so existing claimed seats won't pick up the new
                # product's benefits without an explicit re-sync.
                if product.has_seat_based_price and subscription.active:
                    await seat_service.update_subscription_benefits_grants(
                        session, subscription
                    )

                # Send product change email notification
                await self.send_subscription_updated_email(
                    session, subscription, product, proration_behavior
                )

            if resolved_discount is not None:
                ctx.add_event_metadata(
                    discount_id=None
                    if resolved_discount == "unset"
                    else str(resolved_discount.id),
                )
            ctx.add_event_metadata(
                product_id=str(product.id),
                proration_behavior=proration_behavior,
            )

            return subscription

    async def clear_pending_update(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
    ) -> Subscription:
        """Clear the pending update for a subscription."""
        if subscription.pending_update is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "pending_update"),
                        "msg": "This subscription has no pending update to clear.",
                        "input": None,
                    }
                ]
            )

        subscription_update_repository = SubscriptionUpdateRepository.from_session(
            session
        )
        await subscription_update_repository.soft_delete_unapplied_by_subscription_id(
            subscription.id
        )
        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(
            subscription, update_dict={"pending_update": None}
        )

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_update_cleared,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata={
                    "subscription_id": str(subscription.id),
                },
            ),
        )

        return subscription

    @contextlib.asynccontextmanager
    async def resolve_discount(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        discount: uuid.UUID | Literal["unset"] | None,
        product: Product,
    ) -> AsyncGenerator[Discount | Literal["unset"] | None, None]:
        if discount is None:
            yield None
            return

        if discount == "unset":
            yield "unset"
            return

        resolved_discount = await discount_service.get_by_id_and_organization(
            session,
            discount,
            subscription.organization,
            products=[product],
        )
        if resolved_discount is None:
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
                        "input": discount,
                    }
                ]
            )
        if resolved_discount == subscription.discount:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "discount_id"),
                        "msg": "This discount is already applied to the subscription.",
                        "input": discount,
                    }
                ]
            )

        async with discount_service.redeem_discount(
            session, resolved_discount
        ) as redemption:
            redemption.subscription = subscription
            yield resolved_discount

    async def update_discount(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        discount: uuid.UUID | Literal["unset"],
    ) -> Subscription:
        repository = SubscriptionRepository.from_session(session)
        async with self.resolve_discount(
            session, ctx, subscription, discount=discount, product=subscription.product
        ) as resolved_discount:
            assert resolved_discount is not None
            ctx.add_event_metadata(
                discount_id=None
                if resolved_discount == "unset"
                else str(resolved_discount.id),
            )
            subscription = await repository.update(
                subscription,
                update_dict={
                    "discount": None
                    if resolved_discount == "unset"
                    else resolved_discount
                },
                flush=True,
            )
            return subscription

    async def update_trial(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        trial_end: datetime | Literal["now"],
    ) -> Subscription:
        if not subscription.active:
            raise InactiveSubscription(subscription)

        # Already trialing
        if subscription.trialing:
            # End trial immediately
            if trial_end == "now":
                subscription.trial_end = subscription.current_period_end = utc_now()
                # Make sure to cycle the subscription immediately to update status and trigger order
                ctx.set_billing_effect("cycle")
            # Set new trial end date
            else:
                subscription.trial_end = subscription.current_period_end = trial_end
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
                # Ensure trial_end is after current_period_end to prevent customer loss
                if trial_end <= subscription.current_period_end:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "trial_end"),
                                "msg": "Trial end must be after the current period end.",
                                "input": trial_end,
                            }
                        ]
                    )
                subscription.status = SubscriptionStatus.trialing
                subscription.trial_end = subscription.current_period_end = trial_end

        # Keep any pending update's cycle end in sync with the new period end,
        # otherwise apply_update() will clobber current_period_end back to the
        # stale value when cycle() next runs.
        if subscription.pending_update is not None:
            subscription_update_repository = SubscriptionUpdateRepository.from_session(
                session
            )
            subscription.pending_update.new_cycle_end = subscription.current_period_end
            await subscription_update_repository.update(subscription.pending_update)

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(subscription)

        assert subscription.trial_end is not None
        ctx.add_event_metadata(
            trial_end=subscription.trial_end.isoformat(),
        )

        return subscription

    async def update_seats(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        seats: int,
        proration_behavior: SubscriptionProrationBehavior | None = None,
    ) -> Subscription:
        await self.validate_seats_change(session, subscription, seats=seats)

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            subscription.product.organization_id
        )
        assert organization is not None

        if proration_behavior is None:
            proration_behavior = organization.proration_behavior

        old_seats = subscription.seats or 1
        old_amount = subscription.amount

        subscription_update_repository = SubscriptionUpdateRepository.from_session(
            session
        )

        if old_seats == seats:
            # Re-asserting the current seat count cancels a pending seat
            # change. Drop the row if nothing else is scheduled on it.
            pending = subscription.pending_update
            if pending is not None and pending.seats is not None:
                if pending.product_id is None:
                    await subscription_update_repository.soft_delete(pending)
                    subscription.pending_update = None
                else:
                    pending.seats = None
                    await subscription_update_repository.update(pending)
            return subscription

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
            subscription, proration_behavior, seats=seats
        )

        if proration_behavior == SubscriptionProrationBehavior.next_period:
            subscription.pending_update = await subscription_update_repository.upsert(
                subscription_update
            )
        else:
            existing_pending = subscription.pending_update
            if existing_pending is not None and existing_pending.product_id is not None:
                # Preserve the scheduled product change. `apply_update`
                # will read the updated `subscription.seats` at cycle
                # time, so the new count applies to the new product.
                # The pending row's own seats field is cleared; otherwise
                # the cycle would reset the live count to that value.
                if existing_pending.seats is not None:
                    existing_pending.seats = None
                    await subscription_update_repository.update(existing_pending)
            else:
                await subscription_update_repository.soft_delete_unapplied_by_subscription_id(
                    subscription.id
                )
                subscription.pending_update = None

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

            if (
                proration_behavior.is_immediate()
                and not subscription.trialing
                and billing_entries
            ):
                # Invoice and attempt to pay immediately
                ctx.set_billing_effect("invoice")

        ctx.add_event_metadata(
            seats=seats,
            proration_behavior=proration_behavior,
        )

        return subscription

    async def update_currrent_billing_period_end(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
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

        previous_status = subscription.status
        previous_is_canceled = subscription.canceled
        old_period_end = subscription.current_period_end

        subscription.current_period_end = new_period_end
        subscription.anchor_day = new_period_end.day

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

        ctx.add_event_metadata(
            billing_period_end=subscription.current_period_end.isoformat()
        )

        return subscription

    async def uncancel(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
    ) -> Subscription:
        if subscription.ended_at:
            raise ResourceUnavailable()

        if not (
            subscription.status in SubscriptionStatus.billable_statuses()
            and subscription.cancel_at_period_end
        ):
            raise BadRequest()

        subscription.cancel_at_period_end = False
        subscription.ends_at = None
        subscription.canceled_at = None
        subscription.customer_cancellation_reason = None
        subscription.customer_cancellation_comment = None
        session.add(subscription)
        return subscription

    async def revoke(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
    ) -> Subscription:
        return await self._perform_cancellation(
            session,
            ctx,
            subscription,
            customer_reason=customer_reason,
            customer_comment=customer_comment,
            immediately=True,
        )

    async def cancel(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
    ) -> Subscription:
        return await self._perform_cancellation(
            session,
            ctx,
            subscription,
            customer_reason=customer_reason,
            customer_comment=customer_comment,
        )

    async def pause(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        resumes_at: datetime | None = None,
    ) -> Subscription:
        if not subscription.can_pause():
            raise CannotPauseSubscription(subscription)

        if resumes_at is not None and resumes_at <= subscription.current_period_end:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "resumes_at"),
                        "msg": "resumes_at must be after the current period end.",
                        "input": resumes_at,
                    }
                ]
            )

        subscription.pause_at_period_end = True
        subscription.resumes_at = resumes_at
        session.add(subscription)

        # Notify the customer at request time, while the subscription is still
        # active until the end of the current period.
        # The actual`paused` transition happens later in `cycle()`.
        await self.send_paused_email(session, subscription)

        return subscription

    async def cancel_scheduled_pause(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
    ) -> Subscription:
        if not subscription.can_cancel_scheduled_pause():
            raise NoScheduledPause(subscription)

        subscription.pause_at_period_end = False
        subscription.resumes_at = None
        session.add(subscription)
        return subscription

    async def resume(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
    ) -> Subscription:
        if not subscription.can_resume():
            raise NotPausedSubscription(subscription)

        # Defensive: renewals may have been disabled while the subscription was
        # paused. Resuming starts a fresh period and charges immediately, so skip
        # rather than bill a subscription the organization can no longer renew.
        if not subscription.organization.can_renew_subscriptions:
            log.info(
                "Subscription renewals disabled for organization, skipping resume",
                subscription_id=subscription.id,
                organization_id=subscription.organization.id,
            )
            return subscription

        now = utc_now()
        subscription.status = SubscriptionStatus.active
        subscription.paused_at = None
        subscription.resumes_at = None
        subscription.scheduler_locked_at = None

        # Start a fresh billing period from now and charge immediately.
        subscription.current_period_start = now
        subscription.anchor_day = now.day
        subscription.current_period_end = (
            subscription.recurring_interval.get_next_period(
                now, subscription.anchor_day, subscription.recurring_interval_count
            )
        )
        subscription.initialize_meter_period(now)

        await self.enqueue_benefits_grants(session, subscription)
        await self._create_cycle_billing_entries(session, subscription)

        repository = SubscriptionRepository.from_session(session)
        subscription = await repository.update(subscription)

        enqueue_job(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReasonInternal.subscription_cycle,
        )

        log.info(
            "subscription.resumed",
            id=subscription.id,
            current_period_end=subscription.current_period_end,
        )
        return subscription

    async def cancel_customer(
        self, session: AsyncSession, customer_id: uuid.UUID
    ) -> None:
        """Immediately cancel all billable subscriptions of a customer.

        Used when a customer is deleted. This includes ``past_due`` subscriptions,
        whose pending orders would otherwise keep being retried by dunning. Revoking
        them voids any pending order through ``_on_subscription_revoked``.
        """
        subscription_repository = SubscriptionRepository.from_session(session)
        subscriptions = await subscription_repository.list_billable_by_customer(
            customer_id, options=subscription_repository.get_eager_options()
        )
        for subscription in subscriptions:
            async with SubscriptionUpdateContext(session, subscription, self) as ctx:
                await self._perform_cancellation(
                    session,
                    ctx,
                    subscription,
                    immediately=True,
                    # Benefits are revoked through `benefit.revoke_customer`
                    revoke_benefits=False,
                )

    async def cancel_for_organization(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        *,
        batch_size: int = SUBSCRIPTION_CANCELLATION_BATCH_SIZE,
    ) -> bool:
        """Immediately cancel a batch of an organization's billable
        subscriptions, without notifying its customers (the cancellation follows
        the merchant being shut down, not a customer or merchant action).

        Returns ``True`` when more subscriptions may remain and the caller should
        re-enqueue the job, ``False`` once the organization is fully wound down.

        Cancels at most ``batch_size`` subscriptions per call so a large merchant
        completes across several short jobs instead of one long one: the worker
        enforces a 60s time limit, and a single transaction exceeding it is
        rolled back wholesale, making no progress on retry. Each cancelled
        subscription leaves the billable set, so the next call naturally resumes
        where this one stopped; the work is idempotent and resumable.

        Locks the org row (``for_update``) before re-checking its status, since
        this runs as a deferred job: it serializes against a concurrent admin
        reactivation (we must not cancel a reinstated org) and against another
        copy of this job for the same org (which would otherwise duplicate
        cancellation side effects). If the org is no longer in a wind-down
        status, this is a no-op. ``include_blocked=True`` because ``blocked`` is
        itself a wind-down status. An already-cancelled subscription is skipped,
        not treated as an error.
        """
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            organization_id, include_blocked=True, for_update=True
        )
        if (
            organization is None
            or organization.status not in SUBSCRIPTION_CANCELLATION_STATUSES
        ):
            return False

        subscription_repository = SubscriptionRepository.from_session(session)
        statement = (
            subscription_repository.get_billable_by_organization_statement(
                organization_id, options=subscription_repository.get_eager_options()
            )
            .order_by(Subscription.created_at)
            .limit(batch_size)
        )
        subscriptions = await subscription_repository.get_all(statement)
        for subscription in subscriptions:
            try:
                async with SubscriptionUpdateContext(
                    session, subscription, self, notify_customer=False
                ) as ctx:
                    await self._perform_cancellation(
                        session, ctx, subscription, immediately=True
                    )
            except AlreadyCanceledSubscription:
                continue

        return len(subscriptions) == batch_size

    async def _perform_cancellation(
        self,
        session: AsyncSession,
        ctx: SubscriptionUpdateContext,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
        immediately: bool = False,
        revoke_benefits: bool = True,
    ) -> Subscription:
        if not subscription.can_cancel(immediately):
            raise AlreadyCanceledSubscription(subscription)

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
        nested = await session.begin_nested()
        try:
            return await self._compute_charge_preview(session, subscription)
        finally:
            await nested.rollback()

    async def _compute_charge_preview(
        self, session: AsyncSession, subscription: Subscription
    ) -> SubscriptionChargePreview:
        # Apply any pending subscription update (product change, seats change)
        pending_update = subscription.pending_update
        if pending_update is not None:
            pending_update.subscription = subscription
            if pending_update.product_id is not None:
                product_repository = ProductRepository.from_session(session)
                pending_update.product = await product_repository.get_by_id(
                    pending_update.product_id,
                    options=product_repository.get_eager_options(),
                )
            else:
                pending_update.product = None
            if pending_update.discount_id is not None:
                discount_repository = DiscountRepository.from_session(session)
                pending_update.discount = await discount_repository.get_by_id(
                    pending_update.discount_id
                )
            else:
                pending_update.discount = None
            pending_update.apply_update()

        # If subscription is set to cancel at period end, there's no base charge
        # Only metered charges accumulated during the period will be billed
        if subscription.cancel_at_period_end or subscription.ends_at:
            base_price = 0
        else:
            base_price = sum(p.amount for p in subscription.subscription_product_prices)

        metered_amount = sum(meter.amount for meter in subscription.meters)

        items = [
            LineItem(amount=base_price, discountable=True),
            LineItem(amount=metered_amount, discountable=True),
        ]

        # Pending mid-period prorations (seat/product changes) already exist as
        # billing entries; surface them so the preview matches the next invoice.
        prorations: list[SubscriptionChargePreviewProration] = []
        proration_amount = 0
        async for (
            line_item,
            _,
        ) in billing_entry_service.compute_pending_subscription_line_items(
            session, subscription
        ):
            if not line_item.proration:
                continue
            prorations.append(
                SubscriptionChargePreviewProration(
                    label=line_item.label, amount=line_item.amount
                )
            )
            proration_amount += line_item.amount
            items.append(LineItem(amount=line_item.amount, discountable=False))

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

        amounts = await compute_order_amounts(
            subscription,
            items,
            reference=str(subscription.id),
            discount=applicable_discount,
        )

        return SubscriptionChargePreview(
            base_amount=base_price,
            metered_amount=metered_amount,
            proration_amount=proration_amount,
            prorations=prorations,
            subtotal_amount=amounts.subtotal_amount,
            discount_amount=amounts.discount_amount,
            net_amount=amounts.net_amount,
            tax_amount=amounts.tax_amount,
            total_amount=amounts.total_amount,
        )

    async def calculate_change_preview(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        product_id: uuid.UUID | None = None,
        seats: int | None = None,
        proration_behavior: SubscriptionProrationBehavior | None = None,
        allowed_visibilities: frozenset[Visibility] = frozenset(Visibility),
    ) -> SubscriptionChargePreview:
        # The change is applied inside a savepoint: the preview prices the rows the
        # invoice would bill.
        nested = await session.begin_nested()
        try:
            return await self._compute_change_preview(
                session,
                subscription,
                product_id=product_id,
                seats=seats,
                proration_behavior=proration_behavior,
                allowed_visibilities=allowed_visibilities,
            )
        finally:
            await nested.rollback()

    async def _compute_change_preview(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        product_id: uuid.UUID | None,
        seats: int | None,
        proration_behavior: SubscriptionProrationBehavior | None,
        allowed_visibilities: frozenset[Visibility],
    ) -> SubscriptionChargePreview:
        assert (product_id is None) != (seats is None), "exactly one change per preview"

        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            subscription.product.organization_id
        )
        assert organization is not None
        if proration_behavior is None:
            proration_behavior = organization.proration_behavior

        product: Product | None = None
        if product_id is not None:
            product, _ = await self.validate_product_change(
                session,
                subscription,
                product_id=product_id,
                allowed_visibilities=allowed_visibilities,
            )
            event = build_system_event(
                SystemEvent.subscription_product_updated,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata={
                    "subscription_id": str(subscription.id),
                    "old_product_id": str(subscription.product.id),
                    "new_product_id": str(product.id),
                },
            )
        else:
            assert seats is not None
            await self.validate_seats_change(session, subscription, seats=seats)
            event = build_system_event(
                SystemEvent.subscription_seats_updated,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata={
                    "subscription_id": str(subscription.id),
                    "old_seats": subscription.seats or 1,
                    "new_seats": seats,
                    "proration_behavior": proration_behavior.value,
                },
            )

        subscription_update, billing_entries = generate_subscription_update(
            subscription, proration_behavior, product=product, seats=seats
        )

        applies_now = proration_behavior != SubscriptionProrationBehavior.next_period

        if applies_now and subscription.trialing:
            # Ending the trial bills a full period of the new product; keeping it
            # bills nothing today. Either way, a trial has no proration to surface.
            if (
                product is not None
                and self._resolve_trial_end(subscription, product) is None
            ):
                subscription_update.apply_update()
                return await self._preview_amounts(
                    subscription,
                    [
                        LineItem(amount=spp.amount, discountable=True)
                        for spp in subscription.subscription_product_prices
                        if is_static_price(spp.product_price)
                    ],
                    prorations=[],
                    proration_amount=0,
                )
            return await self._preview_amounts(
                subscription, [], prorations=[], proration_amount=0
            )

        if applies_now:
            session.add(event)
            for entry in billing_entries:
                entry.event = event
                session.add(entry)
            await session.flush()

        prorations: list[SubscriptionChargePreviewProration] = []
        proration_amount = 0
        items: list[LineItem] = []
        async for (
            line_item,
            _,
        ) in billing_entry_service.compute_pending_subscription_line_items(
            session, subscription
        ):
            if not line_item.proration:
                continue
            prorations.append(
                SubscriptionChargePreviewProration(
                    label=line_item.label, amount=line_item.amount
                )
            )
            proration_amount += line_item.amount
            items.append(LineItem(amount=line_item.amount, discountable=False))

        return await self._preview_amounts(
            subscription,
            items,
            prorations=prorations,
            proration_amount=proration_amount,
        )

    def _resolve_trial_end(
        self, subscription: Subscription, product: Product
    ) -> datetime | None:
        """The trial's end under `product`, or None when it ends immediately."""
        assert subscription.trial_start is not None
        if product.trial_interval is None or product.trial_interval_count is None:
            return None
        candidate_trial_end = product.trial_interval.get_end(
            subscription.trial_start, product.trial_interval_count
        )
        return None if candidate_trial_end <= utc_now() else candidate_trial_end

    async def _preview_amounts(
        self,
        subscription: Subscription,
        items: Sequence[LineItem],
        *,
        prorations: Sequence[SubscriptionChargePreviewProration],
        proration_amount: int,
    ) -> SubscriptionChargePreview:
        amounts = await compute_order_amounts(
            subscription,
            items,
            reference=str(subscription.id),
            discount=subscription.discount,
        )

        return SubscriptionChargePreview(
            base_amount=0,
            metered_amount=0,
            proration_amount=proration_amount,
            prorations=list(prorations),
            subtotal_amount=amounts.subtotal_amount,
            discount_amount=amounts.discount_amount,
            net_amount=amounts.net_amount,
            tax_amount=amounts.tax_amount,
            total_amount=amounts.total_amount,
        )

    async def _after_subscription_updated(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        previous_status: SubscriptionStatus,
        previous_is_canceled: bool,
        notify_customer: bool = True,
    ) -> None:
        await self._on_subscription_updated(session, subscription)

        became_resumed = (
            subscription.active and previous_status == SubscriptionStatus.paused
        )
        # A resume re-activates the subscription but is not a first activation:
        # exclude it so the "new subscription" notification isn't sent again.
        became_activated = (
            subscription.active
            and not SubscriptionStatus.is_active(previous_status)
            and not became_resumed
        )
        became_reactivated = (
            became_activated and previous_status == SubscriptionStatus.past_due
        )
        became_paused = (
            subscription.status == SubscriptionStatus.paused
            and previous_status != SubscriptionStatus.paused
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

        if became_paused:
            await self._on_subscription_paused(session, subscription)

        if became_resumed:
            await self._on_subscription_resumed(session, subscription)

        if became_uncanceled:
            await self._on_subscription_uncanceled(session, subscription)

        if became_past_due:
            await self._on_subscription_past_due(session, subscription)

        if became_canceled or (became_revoked and previous_is_canceled):
            await self._on_subscription_canceled(
                session,
                subscription,
                revoked=became_revoked,
                notify_customer=notify_customer,
            )

        if became_revoked:
            await self._on_subscription_revoked(
                session,
                subscription,
                past_due=became_past_due,
                notify_customer=notify_customer,
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

        if reactivated:
            await event_service.create_event(
                session,
                build_system_event(
                    SystemEvent.subscription_reactivated,
                    customer=subscription.customer,
                    organization=subscription.organization,
                    metadata=SubscriptionReactivatedMetadata(
                        subscription_id=str(subscription.id),
                        product_id=str(subscription.product_id),
                        amount=subscription.amount,
                        currency=subscription.currency,
                        recurring_interval=subscription.recurring_interval.value,
                        recurring_interval_count=subscription.recurring_interval_count,
                    ),
                ),
            )

    async def _on_subscription_paused(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_paused
        )

        assert subscription.paused_at is not None
        metadata = SubscriptionPausedMetadata(
            subscription_id=str(subscription.id),
            product_id=str(subscription.product_id),
            amount=subscription.amount,
            currency=subscription.currency,
            recurring_interval=subscription.recurring_interval.value,
            recurring_interval_count=subscription.recurring_interval_count,
            paused_at=subscription.paused_at.isoformat(),
        )
        if subscription.resumes_at is not None:
            metadata["resumes_at"] = subscription.resumes_at.isoformat()

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_paused,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=metadata,
            ),
        )

    async def _on_subscription_resumed(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_resumed
        )

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_resumed,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=SubscriptionResumedMetadata(
                    subscription_id=str(subscription.id),
                    product_id=str(subscription.product_id),
                    amount=subscription.amount,
                    currency=subscription.currency,
                    recurring_interval=subscription.recurring_interval.value,
                    recurring_interval_count=subscription.recurring_interval_count,
                ),
            ),
        )

        await self.send_resumed_email(session, subscription)

    async def _on_subscription_past_due(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_past_due
        )

        assert subscription.past_due_at is not None
        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.subscription_past_due,
                customer=subscription.customer,
                organization=subscription.organization,
                metadata=SubscriptionPastDueMetadata(
                    subscription_id=str(subscription.id),
                    product_id=str(subscription.product_id),
                    past_due_at=subscription.past_due_at.isoformat(),
                    amount=subscription.amount,
                    currency=subscription.currency,
                    recurring_interval=subscription.recurring_interval.value,
                    recurring_interval_count=subscription.recurring_interval_count,
                ),
            ),
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
        notify_customer: bool = True,
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
        if not revoked and notify_customer:
            await self.send_cancellation_email(session, subscription)

    async def _on_subscription_revoked(
        self,
        session: AsyncSession,
        subscription: Subscription,
        past_due: bool,
        notify_customer: bool = True,
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
        if not past_due and notify_customer:
            await self.send_revoked_email(session, subscription)

        # Void all pending orders for this subscription
        enqueue_job("order.void_pending_orders_for_subscription", subscription.id)

    async def _send_new_subscription_notification(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        product = subscription.product

        await notifications_service.send_to_org_members(
            session,
            org_id=product.organization_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_new_paid_subscription,
                payload=MaintainerNewPaidSubscriptionNotificationPayload(
                    subscriber_name=subscription.customer.display_name,
                    subscriber_email=subscription.customer.email,
                    tier_name=product.name,
                    tier_price_amount=subscription.amount,
                    tier_price_recurring_interval=subscription.recurring_interval,
                    tier_price_recurring_interval_count=subscription.recurring_interval_count,
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
            WebhookEventType.subscription_paused,
            WebhookEventType.subscription_resumed,
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
        repository = SubscriptionRepository.from_session(session)
        subscription_ids = await repository.get_ids_by_product(product.id)

        calculate_delay = make_bulk_job_delay_calculator(
            len(subscription_ids), max_spread_ms=30 * 60 * 1000
        )
        for index, subscription_id in enumerate(subscription_ids):
            enqueue_job(
                "subscription.enqueue_benefits_grants",
                subscription_id,
                delay=calculate_delay(index),
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
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription payment is past due",
            template_name="subscription_past_due",
        )

    async def send_paused_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription is paused",
            template_name="subscription_paused",
        )

    async def send_resumed_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription has resumed",
            template_name="subscription_resumed",
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

    async def send_renewal_reminder_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        if all(
            spp.product_price.is_free
            for spp in subscription.subscription_product_prices
        ):
            return
        if subscription.current_period_end is None:
            return
        renewal_date = subscription.current_period_end.strftime("%m/%d/%Y")
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} subscription renews soon",
            template_name="subscription_renewal_reminder",
            extra_context={"renewal_date": renewal_date},
        )

    async def send_trial_conversion_reminder_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        if all(
            spp.product_price.is_free
            for spp in subscription.subscription_product_prices
        ):
            return
        if subscription.trial_end is None:
            return
        conversion_date = subscription.trial_end.strftime("%m/%d/%Y")
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {product.name} trial is ending soon",
            template_name="subscription_trial_conversion_reminder",
            extra_context={"conversion_date": conversion_date},
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
            "subscription_paused",
            "subscription_resumed",
            "subscription_renewal_reminder",
            "subscription_revoked",
            "subscription_trial_conversion_reminder",
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

        # Read-default to enabled: the key is absent from the stored settings of
        # organizations created before this template existed, and is materialized
        # only when an admin next edits their notification settings.
        if not organization.customer_email_settings.get(template_name, True):
            return

        customer = subscription.customer

        recipients = await customer_service.get_email_recipients(session, customer)
        if not recipients:
            return

        subject = subject_template.format(product=product)

        async def send_to_recipients(recipients: Sequence[str]) -> None:
            for recipient_email in recipients:
                token = await customer_service.create_session_token_for_recipient(
                    session, customer, recipient_email
                )
                if token is None:
                    continue

                query_string = urlencode(
                    {
                        "customer_session_token": token,
                        "id": str(subscription.id),
                        "email": recipient_email,
                    }
                )
                portal_url = settings.generate_frontend_url(
                    f"/{organization.slug}/portal?{query_string}"
                )

                email = EmailAdapter.validate_python(
                    {
                        "template": template_name,
                        "props": {
                            "email": recipient_email,
                            "organization": organization,
                            "product": product,
                            "subscription": subscription,
                            "url": portal_url,
                            **(extra_context or {}),
                        },
                    }
                )

                enqueue_email_template(
                    email,
                    **organization.email_from_reply,
                    to_email_addr=recipient_email,
                    subject=subject,
                )

        await send_to_recipients(recipients)

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

        if subscription.ended_at is not None:
            return subscription

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
