import typing
import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any, Literal, cast, overload

import stripe as stripe_lib
from sqlalchemy import Select, UnaryExpression, and_, asc, case, desc, select
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from polar.auth.models import (
    AuthSubject,
    is_organization,
    is_user,
)
from polar.checkout.eventstream import CheckoutEvent, publish_checkout_event
from polar.checkout.service import checkout as checkout_service
from polar.config import settings
from polar.customer.service import customer as customer_service
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.service import discount as discount_service
from polar.email.renderer import get_email_renderer
from polar.email.sender import enqueue_email, get_email_sender
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    BenefitGrant,
    Checkout,
    Customer,
    Discount,
    Organization,
    Product,
    ProductBenefit,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerNewPaidSubscriptionNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.organization.service import organization as organization_service
from polar.postgres import sql
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookTypeObject
from polar.worker import enqueue_job

from ..product.service.product import product as product_service
from ..product.service.product_price import product_price as product_price_service


class SubscriptionError(PolarError): ...


class AssociatedSubscriptionTierPriceDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str, stripe_price_id: str) -> None:
        self.subscription_id = stripe_subscription_id
        self.price_id = stripe_price_id
        message = (
            f"Received the subscription {stripe_subscription_id} from Stripe "
            f"with price {stripe_price_id}, "
            "but no associated SubscriptionTierPrice exists."
        )
        super().__init__(message)


class CustomPriceNotSupported(SubscriptionError):
    def __init__(self, stripe_subscription_id: str, stripe_price_id: str) -> None:
        self.subscription_id = stripe_subscription_id
        self.price_id = stripe_price_id
        message = "Custom prices are not supported for subscriptions."
        super().__init__(message)


class SubscriptionDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str) -> None:
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received a subscription update from Stripe for {stripe_subscription_id}, "
            f"but no associated Subscription exists."
        )
        super().__init__(message)


class DiscountDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str, coupon_id: str) -> None:
        self.stripe_subscription_id = stripe_subscription_id
        self.coupon_id = coupon_id
        message = (
            f"Received subscription {stripe_subscription_id} from Stripe "
            f"with coupon {coupon_id}, but no associated Discount exists."
        )
        super().__init__(message)


class CheckoutDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str, checkout_id: str) -> None:
        self.stripe_subscription_id = stripe_subscription_id
        self.checkout_id = checkout_id
        message = (
            f"Received subscription {stripe_subscription_id} from Stripe "
            f"with checkout {checkout_id}, but no associated Checkout exists."
        )
        super().__init__(message)


class EndDateInTheFuture(SubscriptionError):
    def __init__(self, end_date: date) -> None:
        self.end_date = end_date
        message = "Can't generate statistics for a period that ends in the future."
        super().__init__(message)


@overload
def _from_timestamp(t: int) -> datetime: ...


@overload
def _from_timestamp(t: None) -> None: ...


def _from_timestamp(t: int | None) -> datetime | None:
    if t is None:
        return None
    return datetime.fromtimestamp(t, UTC)


class SubscriptionSortProperty(StrEnum):
    customer = "customer"
    status = "status"
    started_at = "started_at"
    current_period_end = "current_period_end"
    amount = "amount"
    product = "product"
    discount = "discount"


class SubscriptionService(ResourceServiceReader[Subscription]):
    async def get(
        self,
        session: AsyncSession,
        id: uuid.UUID,
        allow_deleted: bool = False,
        *,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> Subscription | None:
        query = select(Subscription).where(Subscription.id == id)

        if not allow_deleted:
            query = query.where(Subscription.deleted_at.is_(None))

        if options is not None:
            query = query.options(*options)
        else:
            query = query.options(
                joinedload(Subscription.customer),
                joinedload(Subscription.price),
                joinedload(Subscription.product).options(
                    selectinload(Product.product_medias),
                    selectinload(Product.attached_custom_fields),
                ),
                joinedload(Subscription.discount),
            )

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

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
        pagination: PaginationParams,
        sorting: list[Sorting[SubscriptionSortProperty]] = [
            (SubscriptionSortProperty.started_at, True)
        ],
    ) -> tuple[Sequence[Subscription], int]:
        statement = self._get_readable_subscriptions_statement(auth_subject).where(
            Subscription.started_at.is_not(None)
        )

        statement = (
            statement.join(Subscription.customer)
            .join(Subscription.price, isouter=True)
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

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SubscriptionSortProperty.customer:
                order_by_clauses.append(clause_function(Customer.email))
            if criterion == SubscriptionSortProperty.status:
                order_by_clauses.append(
                    clause_function(
                        case(
                            (Subscription.status == SubscriptionStatus.incomplete, 1),
                            (
                                Subscription.status
                                == SubscriptionStatus.incomplete_expired,
                                2,
                            ),
                            (Subscription.status == SubscriptionStatus.trialing, 3),
                            (
                                Subscription.status == SubscriptionStatus.active,
                                case(
                                    (Subscription.cancel_at_period_end.is_(False), 4),
                                    (Subscription.cancel_at_period_end.is_(True), 5),
                                ),
                            ),
                            (Subscription.status == SubscriptionStatus.past_due, 6),
                            (Subscription.status == SubscriptionStatus.canceled, 7),
                            (Subscription.status == SubscriptionStatus.unpaid, 8),
                        )
                    )
                )
            if criterion == SubscriptionSortProperty.started_at:
                order_by_clauses.append(clause_function(Subscription.started_at))
            if criterion == SubscriptionSortProperty.current_period_end:
                order_by_clauses.append(
                    clause_function(Subscription.current_period_end)
                )
            if criterion == SubscriptionSortProperty.amount:
                order_by_clauses.append(
                    clause_function(
                        case(
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.year,
                                Subscription.amount / 12,
                            ),
                            (
                                Subscription.recurring_interval
                                == SubscriptionRecurringInterval.month,
                                Subscription.amount,
                            ),
                        )
                    ).nulls_last()
                )
            if criterion == SubscriptionSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
            if criterion == SubscriptionSortProperty.discount:
                order_by_clauses.append(clause_function(Discount.name))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            contains_eager(Subscription.product).options(
                selectinload(Product.product_medias),
                selectinload(Product.attached_custom_fields),
            ),
            contains_eager(Subscription.price),
            contains_eager(Subscription.discount),
            contains_eager(Subscription.customer),
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_stripe_subscription_id(
        self, session: AsyncSession, stripe_subscription_id: str
    ) -> Subscription | None:
        statement = (
            select(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_subscription_id)
            .options(joinedload(Subscription.customer))
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    @typing.overload
    async def create_arbitrary_subscription(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        product: Product,
        price: ProductPriceFixed,
    ) -> Subscription: ...

    @typing.overload
    async def create_arbitrary_subscription(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        product: Product,
        price: ProductPriceCustom,
        amount: int,
    ) -> Subscription: ...

    @typing.overload
    async def create_arbitrary_subscription(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        product: Product,
        price: ProductPriceFree,
    ) -> Subscription: ...

    async def create_arbitrary_subscription(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        product: Product,
        price: ProductPriceFixed | ProductPriceCustom | ProductPriceFree,
        amount: int | None = None,
    ) -> Subscription:
        subscription_amount: int | None = None
        subscription_currency: str | None = None
        if isinstance(price, ProductPriceFixed):
            subscription_amount = price.price_amount
            subscription_currency = price.price_currency
        elif isinstance(price, ProductPriceCustom):
            subscription_amount = amount
            subscription_currency = price.price_currency

        start = utc_now()
        subscription = Subscription(
            status=SubscriptionStatus.active,
            amount=subscription_amount,
            currency=subscription_currency,
            recurring_interval=price.recurring_interval
            if price is not None
            else SubscriptionRecurringInterval.month,
            current_period_start=start,
            cancel_at_period_end=False,
            started_at=start,
            customer=customer,
            product=product,
            price=price,
        )
        session.add(subscription)
        await session.flush()

        await self.enqueue_benefits_grants(session, subscription)

        await self._after_subscription_created(session, subscription)

        return subscription

    async def create_subscription_from_stripe(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        price_id = stripe_subscription["items"].data[0].price.id
        price = await product_price_service.get_by_stripe_price_id(session, price_id)
        if price is None:
            raise AssociatedSubscriptionTierPriceDoesNotExist(
                stripe_subscription.id, price_id
            )
        if isinstance(price, ProductPriceCustom):
            raise CustomPriceNotSupported(stripe_subscription.id, price_id)

        subscription_tier = price.product
        subscription_tier_org = await organization_service.get(
            session, subscription_tier.organization_id
        )
        assert subscription_tier_org is not None

        # Get Discount if available
        discount: Discount | None = None
        if stripe_subscription.discount is not None:
            coupon = stripe_subscription.discount.coupon
            if (metadata := coupon.metadata) is None:
                raise DiscountDoesNotExist(stripe_subscription.id, coupon.id)
            discount_id = metadata["discount_id"]
            discount = await discount_service.get(
                session, uuid.UUID(discount_id), allow_deleted=True
            )
            if discount is None:
                raise DiscountDoesNotExist(stripe_subscription.id, coupon.id)

        # Get Checkout if available
        checkout: Checkout | None = None
        if (checkout_id := stripe_subscription.metadata.get("checkout_id")) is not None:
            checkout = await checkout_service.get(session, uuid.UUID(checkout_id))
            if checkout is None:
                raise CheckoutDoesNotExist(stripe_subscription.id, checkout_id)
        subscription: Subscription | None = None

        # Upgrade from a subscription set in metadata
        existing_subscription_id = stripe_subscription.metadata.get("subscription_id")
        if existing_subscription_id is not None:
            statement = (
                select(Subscription)
                .where(Subscription.id == uuid.UUID(existing_subscription_id))
                .options(joinedload(Subscription.customer))
            )
            result = await session.execute(statement)
            subscription = result.unique().scalar_one_or_none()

        # New subscription
        if subscription is None:
            subscription = Subscription()

        subscription.stripe_subscription_id = stripe_subscription.id
        subscription.status = SubscriptionStatus(stripe_subscription.status)
        subscription.current_period_start = _from_timestamp(
            stripe_subscription.current_period_start
        )
        subscription.current_period_end = _from_timestamp(
            stripe_subscription.current_period_end
        )
        subscription.cancel_at_period_end = stripe_subscription.cancel_at_period_end
        subscription.ended_at = _from_timestamp(stripe_subscription.ended_at)

        subscription.discount = discount
        subscription.price = price
        subscription.recurring_interval = price.recurring_interval
        if isinstance(price, ProductPriceFixed):
            subscription.amount = price.price_amount
            subscription.currency = price.price_currency
        else:
            subscription.amount = None
            subscription.currency = None
        subscription.product = subscription_tier

        subscription.checkout = checkout
        subscription.user_metadata = {
            **(subscription.user_metadata or {}),
            **(checkout.user_metadata if checkout is not None else {}),
        }
        subscription.custom_field_data = {
            **(subscription.custom_field_data or {}),
            **(checkout.custom_field_data if checkout is not None else {}),
        }

        subscription.set_started_at()

        # Take customer from existing subscription, or retrieve it from Stripe Customer ID
        if subscription.customer is None:
            stripe_customer = await stripe_service.get_customer(
                get_expandable_id(stripe_subscription.customer)
            )
            customer = await customer_service.get_or_create_from_stripe_customer(
                session, stripe_customer, subscription_tier_org
            )
            subscription.customer = customer

        session.add(subscription)
        await session.flush()

        # Notify checkout channel that a subscription has been created from it
        if checkout is not None:
            await publish_checkout_event(
                checkout.client_secret, CheckoutEvent.subscription_created
            )

        await self._after_subscription_created(session, subscription)

        return subscription

    async def _after_subscription_created(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_created
        )
        if subscription.active:
            await self._send_webhook(
                session, subscription, WebhookEventType.subscription_active
            )
            await self._send_new_subscription_notification(session, subscription)

    async def update_subscription_from_stripe(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        subscription = await self.get_by_stripe_subscription_id(
            session, stripe_subscription.id
        )

        if subscription is None:
            raise SubscriptionDoesNotExist(stripe_subscription.id)

        previous_status = subscription.status
        previous_cancel_at_period_end = subscription.cancel_at_period_end

        subscription.status = SubscriptionStatus(stripe_subscription.status)
        subscription.current_period_start = _from_timestamp(
            stripe_subscription.current_period_start
        )
        subscription.current_period_end = _from_timestamp(
            stripe_subscription.current_period_end
        )
        subscription.cancel_at_period_end = stripe_subscription.cancel_at_period_end
        subscription.ended_at = _from_timestamp(stripe_subscription.ended_at)
        subscription.set_started_at()

        price_id = stripe_subscription["items"].data[0].price.id
        price = await product_price_service.get_by_stripe_price_id(session, price_id)
        if price is None:
            raise AssociatedSubscriptionTierPriceDoesNotExist(
                stripe_subscription.id, price_id
            )
        subscription.price = price
        subscription.product = price.product

        # Get Discount if available
        discount: Discount | None = None
        if stripe_subscription.discount is not None:
            coupon = stripe_subscription.discount.coupon
            if (metadata := coupon.metadata) is None:
                raise DiscountDoesNotExist(stripe_subscription.id, coupon.id)
            discount_id = metadata["discount_id"]
            discount = await discount_service.get(
                session, uuid.UUID(discount_id), allow_deleted=True
            )
            if discount is None:
                raise DiscountDoesNotExist(stripe_subscription.id, coupon.id)
            subscription.discount = discount

        # Get Checkout if available
        checkout: Checkout | None = None
        if (checkout_id := stripe_subscription.metadata.get("checkout_id")) is not None:
            checkout = await checkout_service.get(session, uuid.UUID(checkout_id))
            if checkout is None:
                raise CheckoutDoesNotExist(stripe_subscription.id, checkout_id)
        subscription.user_metadata = {
            **(subscription.user_metadata or {}),
            **(checkout.user_metadata if checkout is not None else {}),
        }
        subscription.custom_field_data = {
            **(subscription.custom_field_data or {}),
            **(checkout.custom_field_data if checkout is not None else {}),
        }

        session.add(subscription)

        await self.enqueue_benefits_grants(session, subscription)

        await self._after_subscription_updated(
            session, subscription, previous_status, previous_cancel_at_period_end
        )

        if (
            subscription.active
            and subscription.started_at is not None
            and subscription.started_at.date()
            == subscription.current_period_start.date()
            and not subscription.cancel_at_period_end
        ):
            await self.send_confirmation_email(session, subscription)
        elif subscription.cancel_at_period_end:
            await self.send_cancellation_email(session, subscription)

        return subscription

    async def _after_subscription_updated(
        self,
        session: AsyncSession,
        subscription: Subscription,
        previous_status: SubscriptionStatus,
        previous_cancel_at_period_end: bool,
    ) -> None:
        # Webhooks
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_updated
        )
        if subscription.active and not SubscriptionStatus.is_active(previous_status):
            await self._send_webhook(
                session, subscription, WebhookEventType.subscription_active
            )
        if subscription.revoked and not SubscriptionStatus.is_revoked(previous_status):
            await self._send_webhook(
                session, subscription, WebhookEventType.subscription_revoked
            )
        if subscription.cancel_at_period_end and not previous_cancel_at_period_end:
            await self._send_webhook(
                session, subscription, WebhookEventType.subscription_canceled
            )

        # Notifications
        if subscription.active and SubscriptionStatus.is_incomplete(previous_status):
            await self._send_new_subscription_notification(session, subscription)

    async def _send_new_subscription_notification(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        product = subscription.product
        price = subscription.price
        await notifications_service.send_to_org_members(
            session,
            org_id=product.organization_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_new_paid_subscription,
                payload=MaintainerNewPaidSubscriptionNotificationPayload(
                    subscriber_name=subscription.customer.email,
                    tier_name=product.name,
                    tier_price_amount=subscription.amount,
                    tier_price_recurring_interval=price.recurring_interval,
                    tier_organization_name=subscription.organization.name,
                ),
            ),
        )

    async def _send_webhook(
        self,
        session: AsyncSession,
        subscription: Subscription,
        event_type: Literal[WebhookEventType.subscription_created]
        | Literal[WebhookEventType.subscription_updated]
        | Literal[WebhookEventType.subscription_active]
        | Literal[WebhookEventType.subscription_canceled]
        | Literal[WebhookEventType.subscription_revoked],
    ) -> None:
        # load full subscription with relations
        full_subscription = await self.get(session, subscription.id)
        assert full_subscription

        event = cast(WebhookTypeObject, (event_type, full_subscription))

        if tier := await product_service.get_loaded(session, subscription.product_id):
            if subscribed_to_org := await organization_service.get(
                session, tier.organization_id
            ):
                await webhook_service.send(session, target=subscribed_to_org, we=event)

    async def enqueue_benefits_grants(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        product = await product_service.get(session, subscription.product_id)
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
        email_renderer = get_email_renderer({"subscription": "polar.subscription"})
        email_sender = get_email_sender()

        product = subscription.product
        featured_organization = await organization_service.get(
            session, product.organization_id
        )
        assert featured_organization is not None

        customer = subscription.customer
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )

        subject, body = email_renderer.render_from_template(
            "Your {{ product.name }} subscription",
            "subscription/confirmation.html",
            {
                "featured_organization": featured_organization,
                "product": product,
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

    async def send_cancellation_email(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        email_renderer = get_email_renderer({"subscription": "polar.subscription"})
        email_sender = get_email_sender()

        product = subscription.product
        featured_organization = await organization_service.get(
            session, product.organization_id
        )
        assert featured_organization is not None

        subject, body = email_renderer.render_from_template(
            "Your {{ product.name }} subscription cancellation",
            "subscription/cancellation.html",
            {
                "featured_organization": featured_organization,
                "product": product,
                "subscription": subscription,
                "url": (
                    f"{settings.FRONTEND_BASE_URL}"
                    f"/purchases/subscriptions/{subscription.id}"
                ),
                "current_year": datetime.now().year,
            },
        )

        enqueue_email(
            to_email_addr=subscription.customer.email,
            subject=subject,
            html_content=body,
        )

    def _get_readable_subscriptions_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[Any]:
        statement = (
            select(Subscription)
            .join(Subscription.product)
            .where(
                Subscription.deleted_at.is_(None),
            )
        )

        if is_user(auth_subject):
            statement = statement.join(
                UserOrganization,
                isouter=True,
                onclause=and_(
                    UserOrganization.organization_id == Product.organization_id,
                    UserOrganization.user_id == auth_subject.subject.id,
                ),
            ).where(
                UserOrganization.user_id == auth_subject.subject.id,
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement

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


subscription = SubscriptionService(Subscription)
