import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal, cast, overload

import stripe as stripe_lib
import structlog
from sqlalchemy import select
from sqlalchemy.orm import contains_eager, selectinload

from polar.auth.models import (
    AuthSubject,
)
from polar.billing_entry.service import billing_entry as billing_entry_service
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.config import settings
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.repository import DiscountRedemptionRepository
from polar.discount.service import discount as discount_service
from polar.email.renderer import get_email_renderer
from polar.email.sender import enqueue_email
from polar.enums import SubscriptionProrationBehavior
from polar.exceptions import (
    BadRequest,
    PolarError,
    PolarRequestValidationError,
    ResourceUnavailable,
)
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.kit.metadata import MetadataQuery, apply_metadata_clause
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.logging import Logger
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    Customer,
    Discount,
    Organization,
    PaymentMethod,
    Product,
    ProductBenefit,
    Subscription,
    SubscriptionMeter,
    SubscriptionProductPrice,
    User,
)
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


class MissingStripeCustomerID(SubscriptionError):
    def __init__(self, checkout: Checkout, customer: Customer) -> None:
        self.checkout = checkout
        self.customer = customer
        message = (
            f"Checkout {checkout.id}'s customer {customer.id} "
            "is missing a Stripe customer ID."
        )
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


class SubscriptionUpdatePending(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = "This subscription is pending an update."
        super().__init__(message, 409)


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
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
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
        session: AsyncSession,
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
        intent: stripe_lib.PaymentIntent | stripe_lib.SetupIntent | None,
    ) -> Subscription:
        idempotency_key = (
            f"subscription_{checkout.id}{'' if intent is None else f'_{intent.id}'}"
        )
        product = checkout.product
        if not product.is_recurring:
            raise NotARecurringProduct(checkout, product)

        customer = checkout.customer
        if customer is None:
            raise MissingCheckoutCustomer(checkout)

        stripe_customer_id = customer.stripe_customer_id
        if stripe_customer_id is None:
            raise MissingStripeCustomerID(checkout, customer)

        stripe_payment_method = (
            await stripe_service.get_payment_method(
                get_expandable_id(intent.payment_method)
            )
            if intent and intent.payment_method
            else None
        )
        payment_method: PaymentMethod | None = None
        if stripe_payment_method is not None:
            payment_method = await payment_method_service.upsert_from_stripe(
                session, customer, stripe_payment_method
            )

        metadata = {
            "type": ProductType.product,
            "product_id": str(checkout.product_id),
            "checkout_id": str(checkout.id),
        }
        invoice_metadata = {
            "checkout_id": str(checkout.id),
        }
        if intent is not None and isinstance(intent, stripe_lib.PaymentIntent):
            invoice_metadata["payment_intent_id"] = intent.id

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
        previous_ends_at = subscription.ends_at if subscription else None
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
            stripe_payment_method.id if stripe_payment_method else None,
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
                previous_ends_at=previous_ends_at,
            )

        # Link potential discount redemption to the subscription
        if subscription.discount is not None:
            discount_redemption_repository = DiscountRedemptionRepository.from_session(
                session
            )
            await discount_redemption_repository.set_subscription_by_checkout(
                checkout.id, subscription.id
            )

        # Notify checkout channel that a subscription has been created from it
        await publish_checkout_event(
            checkout.client_secret, CheckoutEvent.subscription_created
        )

        # Sanity check to make sure we didn't mess up the amount.
        # Don't raise an error so the order can be successfully completed nonetheless.
        if (
            isinstance(intent, stripe_lib.PaymentIntent)
            and stripe_invoice.total != intent.amount
        ):
            log.error(
                "Mismatch between payment intent and invoice amount",
                subscription=subscription.id,
                checkout=checkout.id,
                payment_intent=intent.id,
                invoice=stripe_invoice.id,
            )

        return subscription

    async def _after_subscription_created(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_created
        )
        # ⚠️ In some cases, the subscription is immediately active
        # Make sure then to perform all the operations required!
        if subscription.active:
            await self._on_subscription_activated(session, subscription)

        enqueue_job(
            "customer.webhook",
            WebhookEventType.customer_state_changed,
            subscription.customer_id,
        )

    async def update(
        self,
        session: AsyncSession,
        locker: Locker,
        subscription: Subscription,
        *,
        update: SubscriptionUpdate,
    ) -> Subscription:
        lock_name = f"subscription:{subscription.id}"
        if await locker.is_locked(lock_name):
            raise SubscriptionUpdatePending(subscription)
        async with locker.lock(
            lock_name,
            timeout=10.0,  # Quite long, but we've experienced slow responses from Stripe in test mode
            blocking_timeout=1,
        ):
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

        if subscription.stripe_subscription_id is None:
            raise SubscriptionNotActiveOnStripe(subscription)

        subscription.product = product
        subscription.subscription_product_prices = [
            SubscriptionProductPrice.from_price(price) for price in prices
        ]
        subscription.recurring_interval = product.recurring_interval

        if proration_behavior is None:
            organization_repository = OrganizationRepository.from_session(session)
            organization = await organization_repository.get_by_id(
                product.organization_id
            )
            assert organization is not None
            proration_behavior = organization.proration_behavior

        await stripe_service.update_subscription_price(
            subscription.stripe_subscription_id,
            new_prices=[
                price.stripe_price_id for price in prices if is_static_price(price)
            ],
            proration_behavior=proration_behavior.to_stripe(),
            metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
            },
        )

        session.add(subscription)
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
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> Subscription:
        if subscription.ended_at:
            raise ResourceUnavailable()

        if not (subscription.active and subscription.cancel_at_period_end):
            raise BadRequest()

        # Internal and already revoked
        if not subscription.stripe_subscription_id:
            raise ResourceUnavailable()

        previous_ends_at = subscription.ends_at
        previous_status = subscription.status
        stripe_subscription = await stripe_service.uncancel_subscription(
            subscription.stripe_subscription_id,
        )
        self.update_cancellation_from_stripe(subscription, stripe_subscription)
        subscription.canceled_at = None
        subscription.ends_at = None
        subscription.customer_cancellation_reason = None
        subscription.customer_cancellation_comment = None
        session.add(subscription)

        await self._after_subscription_updated(
            session,
            subscription,
            previous_status=previous_status,
            previous_ends_at=previous_ends_at,
        )
        return subscription

    async def revoke(
        self,
        session: AsyncSession,
        locker: Locker,
        subscription: Subscription,
        *,
        customer_reason: CustomerCancellationReason | None = None,
        customer_comment: str | None = None,
    ) -> Subscription:
        async with locker.lock(
            f"subscription:{subscription.id}", timeout=5, blocking_timeout=5
        ):
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
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
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

        previous_status = subscription.status
        previous_ends_at = subscription.ends_at

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
            previous_ends_at=previous_ends_at,
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
        previous_ends_at = subscription.ends_at

        # Store our own vs. Stripe for better accuracy.
        subscription.canceled_at = utc_now()

        if customer_reason:
            subscription.customer_cancellation_reason = customer_reason

        if customer_comment:
            subscription.customer_cancellation_comment = customer_comment

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
        else:
            subscription.ends_at = utc_now()
            subscription.ended_at = utc_now()
            subscription.status = SubscriptionStatus.canceled

            # free subscriptions end immediately (vs at end of billing period)
            # queue removal of grants
            await self.enqueue_benefits_grants(session, subscription)

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
            previous_ends_at=previous_ends_at,
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

        for (
            line_item,
            _,
        ) in await billing_entry_service.compute_pending_subscription_line_items(
            session, subscription
        ):
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
            previous_ends_at=subscription.ends_at,
        )

        return subscription

    async def _after_subscription_updated(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        previous_status: SubscriptionStatus,
        previous_ends_at: datetime | None,
    ) -> None:
        # Webhooks
        await self._on_subscription_updated(session, subscription)

        became_activated = subscription.active and not SubscriptionStatus.is_active(
            previous_status
        )
        if became_activated:
            await self._on_subscription_activated(session, subscription)

        is_canceled = subscription.ends_at and subscription.canceled_at
        updated_ends_at = subscription.ends_at != previous_ends_at

        cancellation_changed = is_canceled and updated_ends_at
        became_revoked = subscription.revoked and not SubscriptionStatus.is_revoked(
            previous_status
        )

        if cancellation_changed:
            await self._on_subscription_canceled(
                session, subscription, revoked=became_revoked
            )

        became_uncanceled = previous_ends_at and not is_canceled
        if became_uncanceled:
            await self._on_subscription_uncanceled(session, subscription)

        if became_revoked:
            await self._on_subscription_revoked(session, subscription)

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
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_active
        )

        await self.send_confirmation_email(session, subscription)
        await self._send_new_subscription_notification(session, subscription)

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
        revoked: bool = False,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_canceled
        )

        # Revokation both cancels & revokes simultaneously.
        # Send webhook for both, but avoid duplicate email to customers.
        if revoked:
            await self.send_cancellation_email(session, subscription)

    async def _on_subscription_revoked(
        self,
        session: AsyncSession,
        subscription: Subscription,
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_revoked
        )
        await self.send_revoked_email(session, subscription)

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
            subject_template="Your {{ product.name }} subscription",
            template_path="subscription/confirmation.html",
        )

    async def send_uncanceled_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {{ product.name }} subscription is uncanceled",
            template_path="subscription/uncanceled.html",
        )

    async def send_cancellation_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {{ product.name }} subscription cancellation",
            template_path="subscription/cancellation.html",
        )

    async def send_revoked_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        return await self._send_customer_email(
            session,
            subscription,
            subject_template="Your {{ product.name }} subscription has ended",
            template_path="subscription/revoked.html",
        )

    async def _send_customer_email(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        subject_template: str,
        template_path: str,
    ) -> None:
        email_renderer = get_email_renderer({"subscription": "polar.subscription"})

        product = subscription.product
        organization_repository = OrganizationRepository.from_session(session)
        featured_organization = await organization_repository.get_by_id(
            product.organization_id,
            # We block organizations in case of fraud and then refund/cancel
            # so make sure we can still fetch them for the purpose of sending
            # customer emails.
            include_deleted=True,
            include_blocked=True,
        )
        assert featured_organization is not None

        customer = subscription.customer
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        subject, body = email_renderer.render_from_template(
            subject_template,
            template_path,
            {
                "featured_organization": featured_organization,
                "product": product,
                "subscription": subscription,
                "url": settings.generate_frontend_url(
                    f"/{featured_organization.slug}/portal?customer_session_token={token}&id={subscription.id}"
                ),
                "current_year": datetime.now().year,
            },
        )

        enqueue_email(
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


subscription = SubscriptionService()
