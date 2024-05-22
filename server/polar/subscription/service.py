import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any, Literal, cast, overload

import stripe as stripe_lib
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
from slack_sdk.webhook import WebhookClient as SlackWebhookClient
from sqlalchemy import (
    Select,
    UnaryExpression,
    and_,
    asc,
    desc,
    distinct,
    func,
    not_,
    or_,
    select,
    text,
    tuple_,
)
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import (
    Anonymous,
    AuthMethod,
    AuthSubject,
    is_organization,
    is_user,
)
from polar.authz.service import AccessType, Authz
from polar.config import settings
from polar.enums import UserSignupType
from polar.exceptions import NotPermitted, PolarError, ResourceNotFound
from polar.integrations.loops.service import loops as loops_service
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
    OAuthAccount,
    Organization,
    Product,
    ProductBenefit,
    ProductPrice,
    Sale,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.product import SubscriptionTierType
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import TransactionType
from polar.models.user import OAuthPlatform
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    MaintainerNewPaidSubscriptionNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.organization.service import organization as organization_service
from polar.posthog import posthog
from polar.user.service import user as user_service
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookTypeObject
from polar.webhook_notifications.service import webhook_notifications_service
from polar.worker import enqueue_job

from ..product.service.product import product as product_service
from ..product.service.product_price import product_price as product_price_service
from .schemas import (
    FreeSubscriptionCreate,
    SubscriptionsStatisticsPeriod,
    SubscriptionUpgrade,
)


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


class SubscriptionDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str) -> None:
        self.stripe_subscription_id = stripe_subscription_id
        message = (
            f"Received a subscription update from Stripe for {stripe_subscription_id}, "
            f"but no associated Subscription exists."
        )
        super().__init__(message)


class NotAFreeSubscriptionTier(SubscriptionError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = (
            "Can't directly create a subscription to a non-free subscription tier. "
            "You should create a subscribe session."
        )
        super().__init__(message, 403)


class RequiredCustomerEmail(SubscriptionError):
    def __init__(self) -> None:
        message = "The customer email is required."
        super().__init__(message, 422)


class AlreadySubscribed(SubscriptionError):
    def __init__(
        self,
        *,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = (
            "This user is already subscribed to one of the tier of this organization."
        )
        super().__init__(message, 400)


class AlreadyCanceledSubscription(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            "This subscription is already canceled or will be at the end of the period."
        )
        super().__init__(message)


class FreeSubscriptionUpgrade(SubscriptionError):
    def __init__(self, subscription: Subscription) -> None:
        self.subscription = subscription
        message = (
            "Can't upgrade from free to paid subscription tier to paid directly. "
            "You should start a subscribe session and specify you want to upgrade this "
            "subscription."
        )
        super().__init__(message)


class InvalidSubscriptionTierUpgrade(SubscriptionError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = (
            "Can't upgrade to this subscription tier: either it doesn't exist "
            "or it doesn't belong to the same organization."
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


class SearchSortProperty(StrEnum):
    user = "user"
    status = "status"
    started_at = "started_at"
    current_period_end = "current_period_end"
    price_amount = "price_amount"
    subscription_tier_type = "subscription_tier_type"
    product = "product"


class SubscriptionService(ResourceServiceReader[Subscription]):
    async def get(
        self, session: AsyncSession, id: uuid.UUID, allow_deleted: bool = False
    ) -> Subscription | None:
        query = select(Subscription).where(Subscription.id == id)

        if not allow_deleted:
            query = query.where(Subscription.deleted_at.is_(None))

        query = query.options(
            joinedload(Subscription.user),
            joinedload(Subscription.organization),
            joinedload(Subscription.price),
            joinedload(Subscription.product),
        )

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def search(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization: Organization,
        type: SubscriptionTierType | None = None,
        subscription_tier_id: uuid.UUID | None = None,
        subscriber_user_id: uuid.UUID | None = None,
        subscriber_organization_id: uuid.UUID | None = None,
        active: bool | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SearchSortProperty]] = [
            (SearchSortProperty.started_at, True)
        ],
    ) -> tuple[Sequence[Subscription], int]:
        statement = self._get_readable_subscriptions_statement(auth_subject).where(
            Subscription.started_at.is_not(None)
        )

        statement = statement.join(Subscription.user).join(
            Subscription.price, isouter=True
        )

        if organization is not None:
            statement = statement.where(Product.organization_id == organization.id)

        if type is not None:
            statement = statement.where(Product.type == type)

        if subscription_tier_id is not None:
            statement = statement.where(Product.id == subscription_tier_id)

        if subscriber_user_id is not None:
            statement = statement.where(
                Subscription.user_id == subscriber_user_id,
                Subscription.organization_id.is_(None),
            )

        if subscriber_organization_id is not None:
            statement = statement.where(
                Subscription.organization_id == subscriber_organization_id
            )

        if active is not None:
            if active:
                statement = statement.where(Subscription.active.is_(True))
            else:
                statement = statement.where(Subscription.canceled.is_(True))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SearchSortProperty.user:
                order_by_clauses.append(clause_function(User.username))
            if criterion == SearchSortProperty.status:
                order_by_clauses.append(clause_function(Subscription.status))
            if criterion == SearchSortProperty.started_at:
                order_by_clauses.append(clause_function(Subscription.started_at))
            if criterion == SearchSortProperty.current_period_end:
                order_by_clauses.append(
                    clause_function(Subscription.current_period_end)
                )
            if criterion == SearchSortProperty.price_amount:
                order_by_clauses.append(
                    clause_function(ProductPrice.price_amount).nulls_last()
                )
            if criterion == SearchSortProperty.subscription_tier_type:
                order_by_clauses.append(clause_function(Product.type))
            if criterion == SearchSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            contains_eager(Subscription.product),
            contains_eager(Subscription.price),
            contains_eager(Subscription.user),
            joinedload(Subscription.organization),
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def search_subscribed(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        organization: Organization | None = None,
        type: SubscriptionTierType | None = None,
        subscription_tier_id: uuid.UUID | None = None,
        subscriber_user_id: uuid.UUID | None = None,
        subscriber_organization_id: uuid.UUID | None = None,
        active: bool | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[SearchSortProperty]] = [
            (SearchSortProperty.started_at, True)
        ],
    ) -> tuple[Sequence[Subscription], int]:
        statement = (
            self._get_subscribed_subscriptions_statement(auth_subject)
            .join(Product)
            .join(Subscription.price, isouter=True)
            .where(Subscription.started_at.is_not(None))
        )

        if organization is not None:
            statement = statement.where(Product.organization_id == organization.id)

        if type is not None:
            statement = statement.where(Product.type == type)

        if subscription_tier_id is not None:
            statement = statement.where(Product.id == subscription_tier_id)

        if subscriber_user_id is not None:
            statement = statement.where(
                Subscription.user_id == subscriber_user_id,
                Subscription.organization_id.is_(None),
            )

        if subscriber_organization_id is not None:
            statement = statement.where(
                Subscription.organization_id == subscriber_organization_id
            )

        if active is not None:
            if active:
                statement = statement.where(Subscription.active.is_(True))
            else:
                statement = statement.where(Subscription.canceled.is_(True))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SearchSortProperty.user:
                order_by_clauses.append(clause_function(User.username))
            if criterion == SearchSortProperty.status:
                order_by_clauses.append(clause_function(Subscription.status))
            if criterion == SearchSortProperty.started_at:
                order_by_clauses.append(clause_function(Subscription.started_at))
            if criterion == SearchSortProperty.current_period_end:
                order_by_clauses.append(
                    clause_function(Subscription.current_period_end)
                )
            if criterion == SearchSortProperty.price_amount:
                order_by_clauses.append(clause_function(ProductPrice.price_amount))
            if criterion == SearchSortProperty.subscription_tier_type:
                order_by_clauses.append(clause_function(Product.type))
            if criterion == SearchSortProperty.product:
                order_by_clauses.append(clause_function(Product.name))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            contains_eager(Subscription.product),
            contains_eager(Subscription.price),
            joinedload(Subscription.organization),
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def search_summary(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Subscription], int]:
        statement = (
            (
                select(Subscription)
                .join(Subscription.product)
                .join(User, onclause=User.id == Subscription.user_id, isouter=True)
                .join(
                    OAuthAccount,
                    onclause=and_(
                        User.id == OAuthAccount.user_id,
                        OAuthAccount.platform == OAuthPlatform.github,
                    ),
                    isouter=True,
                )
                .options(
                    contains_eager(Subscription.user),
                    joinedload(Subscription.organization),
                    contains_eager(Subscription.product),
                    joinedload(Subscription.price),
                )
            )
            .where(
                Subscription.active.is_(True),
                Product.organization_id == organization.id,
            )
            .order_by(
                # Put users with a GitHub account first, so we can display their avatar
                OAuthAccount.created_at.desc().nulls_last(),
                Subscription.started_at.desc(),
            )
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_stripe_subscription_id(
        self, session: AsyncSession, stripe_subscription_id: str
    ) -> Subscription | None:
        return await self.get_by(session, stripe_subscription_id=stripe_subscription_id)

    async def get_active_user_subscriptions(
        self,
        session: AsyncSession,
        user: User,
        *,
        organization_id: uuid.UUID | None = None,
    ) -> list[Subscription]:
        statement = (
            select(Subscription)
            .join(Subscription.product)
            .where(Subscription.user_id == user.id, Subscription.active.is_(True))
            .options(contains_eager(Subscription.product))
        )

        if organization_id is not None:
            statement = statement.where(Product.organization_id == organization_id)

        result = await session.execute(statement)

        return list(result.scalars().all())

    async def create_free_subscription(
        self,
        session: AsyncSession,
        *,
        free_subscription_create: FreeSubscriptionCreate,
        auth_subject: AuthSubject[User | Anonymous],
        signup_type: UserSignupType = UserSignupType.backer,
    ) -> Subscription:
        subscription_tier = await product_service.get(
            session, free_subscription_create.tier_id
        )

        if subscription_tier is None:
            raise ResourceNotFound()

        if subscription_tier.type != SubscriptionTierType.free:
            raise NotAFreeSubscriptionTier(subscription_tier.id)

        user: User | None = None
        # Set the user directly only from a cookie-based authentication!
        # With the PAT, it's probably a call from the maintainer who wants to subscribe
        # a backer from their own website
        if is_user(auth_subject) and auth_subject.method == AuthMethod.COOKIE:
            user = auth_subject.subject
        else:
            if free_subscription_create.customer_email is None:
                raise RequiredCustomerEmail()
            user = await user_service.get_by_email_or_signup(
                session,
                email=free_subscription_create.customer_email,
                signup_type=signup_type,
            )

        return await self.create_arbitrary_subscription(
            session, user=user, product=subscription_tier
        )

    async def create_arbitrary_subscription(
        self,
        session: AsyncSession,
        *,
        user: User,
        product: Product,
        price: ProductPrice | None = None,
    ) -> Subscription:
        existing_subscriptions = await self.get_active_user_subscriptions(
            session, user, organization_id=product.organization_id
        )
        if len(existing_subscriptions) > 0:
            raise AlreadySubscribed(
                user_id=user.id,
                organization_id=product.organization_id,
            )

        start = utc_now()
        subscription = Subscription(
            status=SubscriptionStatus.active,
            current_period_start=start,
            cancel_at_period_end=False,
            started_at=start,
            user=user,
            organization=None,
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

        subscription_tier = price.product
        subscription_tier_org = await organization_service.get(
            session, subscription_tier.organization_id
        )
        assert subscription_tier_org is not None

        subscription: Subscription | None = None

        # Upgrade from free subscription tier sets the origin subscription in metadata
        existing_subscription_id = stripe_subscription.metadata.get("subscription_id")
        if existing_subscription_id is not None:
            statement = (
                select(Subscription)
                .where(Subscription.id == uuid.UUID(existing_subscription_id))
                .options(
                    joinedload(Subscription.user), joinedload(Subscription.organization)
                )
            )
            result = await session.execute(statement)
            subscription = result.unique().scalar_one_or_none()

        # New subscription
        if subscription is None:
            subscription = Subscription(user=None)

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
        subscription.price = price
        subscription.product = subscription_tier

        subscription.set_started_at()

        customer_id = get_expandable_id(stripe_subscription.customer)
        customer = stripe_service.get_customer(customer_id)
        customer_email = cast(str, customer.email)

        # Subscribe as organization
        organization_subscriber_id = stripe_subscription.metadata.get(
            "organization_subscriber_id"
        )
        if organization_subscriber_id is not None:
            organization = await organization_service.get(
                session, uuid.UUID(organization_subscriber_id)
            )
            if organization is not None:
                # Take the chance to update Stripe customer ID and billing email
                organization.stripe_customer_id = customer_id
                organization.billing_email = customer_email
                session.add(organization)
                subscription.organization = organization

        # Take user from existing subscription, or get it from metadata
        user_id = stripe_subscription.metadata.get("user_id")
        user: User | None = subscription.user
        if user is None:
            if user_id is not None:
                user = await user_service.get(session, uuid.UUID(user_id))
            if user is None:
                user = await user_service.get_by_email_or_signup(
                    session, customer_email, signup_type=UserSignupType.backer
                )
        subscription.user = user

        # Take the chance to update Stripe customer ID and email marketing
        if subscription.organization is None:
            user.stripe_customer_id = customer_id
            await loops_service.user_update(user, isBacker=True)
            session.add(user)

        session.add(subscription)
        await session.flush()

        posthog.user_event(
            user,
            "subscriptions",
            "subscription",
            "create",
            {"subscription_id": subscription.id},
        )

        # Send notification to managing org
        await notifications_service.send_to_org_admins(
            session,
            org_id=subscription_tier_org.id,
            notif=PartialNotification(
                type=NotificationType.maintainer_new_paid_subscription,
                payload=MaintainerNewPaidSubscriptionNotificationPayload(
                    subscriber_name=customer_email,
                    tier_name=subscription_tier.name,
                    tier_price_amount=price.price_amount,
                    tier_price_recurring_interval=price.recurring_interval,
                    tier_organization_name=subscription_tier_org.name,
                ),
            ),
        )

        enqueue_job(
            "subscription.discord_notification", subscription_id=subscription.id
        )
        enqueue_job(
            "subscription.user_webhook_notifications", subscription_id=subscription.id
        )

        await self._after_subscription_created(session, subscription)

        return subscription

    async def _after_subscription_created(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_created
        )

    async def _after_subscription_updated(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        await self._send_webhook(
            session, subscription, WebhookEventType.subscription_updated
        )

    async def _send_webhook(
        self,
        session: AsyncSession,
        subscription: Subscription,
        event_type: Literal[WebhookEventType.subscription_created]
        | Literal[WebhookEventType.subscription_updated],
    ) -> None:
        # load full subscription with relations
        full_subscription = await self.get(session, subscription.id)
        assert full_subscription

        # mypy 1.9 is does not allow us to do
        #    event = (event_type, subscription)
        # directly, even if it could have...
        event: WebhookTypeObject | None = None
        match event_type:
            case WebhookEventType.subscription_created:
                event = (event_type, full_subscription)
            case WebhookEventType.subscription_updated:
                event = (event_type, full_subscription)

        # subscription created hooks for subscribing organization
        if subscription.organization_id:
            if subscribing_org := await organization_service.get(
                session, subscription.organization_id
            ):
                await webhook_service.send(session, target=subscribing_org, we=event)

        # subscription events for subscribing user
        if subscription.user_id:
            if subscribing_user := await user_service.get(
                session, subscription.user_id
            ):
                await webhook_service.send(session, target=subscribing_user, we=event)

        # subscribed to org
        if tier := await product_service.get_loaded(session, subscription.product_id):
            if subscribed_to_org := await organization_service.get(
                session, tier.organization_id
            ):
                await webhook_service.send(session, target=subscribed_to_org, we=event)

    async def update_subscription_from_stripe(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        subscription = await self.get_by_stripe_subscription_id(
            session, stripe_subscription.id
        )

        if subscription is None:
            raise SubscriptionDoesNotExist(stripe_subscription.id)

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

        session.add(subscription)

        if subscription.cancel_at_period_end or subscription.ended_at:
            user = await user_service.get(session, subscription.user_id)
            if user:
                posthog.user_event(
                    user,
                    "subscriptions",
                    "subscription",
                    "cancel",
                    {"subscription_id": subscription.id},
                )

        await self.enqueue_benefits_grants(session, subscription)

        await self._after_subscription_updated(session, subscription)

        return subscription

    async def enqueue_benefits_grants(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        product = await product_service.get(session, subscription.product_id)
        assert product is not None

        if subscription.is_incomplete():
            return

        task = "grant" if subscription.active else "revoke"
        user_id = subscription.user_id

        enqueue_job(
            "benefit.enqueue_benefits_grants",
            task=task,
            user_id=user_id,
            product_id=product.id,
            subscription_id=subscription.id,
        )

        # Special hard-coded logic to make sure
        # we always at least subscribe to public articles
        if product.get_articles_benefit() is None:
            await session.refresh(product, {"organization"})
            enqueue_job(
                "benefit.force_free_articles",
                task=task,
                user_id=user_id,
                organization_id=product.organization_id,
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

    async def update_organization_benefits_grants(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        statement = select(Subscription).where(
            Subscription.organization_id == organization.id,
            Subscription.deleted_at.is_(None),
        )
        subscriptions = await session.stream_scalars(statement)
        async for subscription in subscriptions:
            await self.enqueue_benefits_grants(session, subscription)

    async def upgrade_subscription(
        self,
        session: AsyncSession,
        *,
        subscription: Subscription,
        subscription_upgrade: SubscriptionUpgrade,
        authz: Authz,
        auth_subject: AuthSubject[User],
    ) -> Subscription:
        if not await authz.can(auth_subject.subject, AccessType.write, subscription):
            raise NotPermitted()

        await session.refresh(
            subscription, {"product", "user", "organization", "price"}
        )

        if subscription.product.type == SubscriptionTierType.free:
            raise FreeSubscriptionUpgrade(subscription)

        new_subscription_tier = await product_service.get_by_id(
            session, auth_subject, subscription_upgrade.subscription_tier_id
        )

        if new_subscription_tier is None:
            raise InvalidSubscriptionTierUpgrade(
                subscription_upgrade.subscription_tier_id
            )

        # Make sure the new tier belongs to the same organization
        old_subscription_tier = subscription.product
        if (
            old_subscription_tier.organization_id
            != new_subscription_tier.organization_id
        ):
            raise InvalidSubscriptionTierUpgrade(new_subscription_tier.id)

        new_price = new_subscription_tier.get_price(subscription_upgrade.price_id)
        if new_price is None:
            raise InvalidSubscriptionTierUpgrade(new_subscription_tier.id)
        assert subscription.price is not None

        stripe_service.update_subscription_price(
            subscription.stripe_subscription_id,
            old_price=subscription.price.stripe_price_id,
            new_price=new_price.stripe_price_id,
        )

        subscription.product = new_subscription_tier
        subscription.price = new_price
        session.add(subscription)

        await self._after_subscription_updated(session, subscription)

        return subscription

    async def cancel_subscription(
        self,
        session: AsyncSession,
        *,
        subscription: Subscription,
        authz: Authz,
        auth_subject: AuthSubject[User],
    ) -> Subscription:
        await session.refresh(
            subscription, {"product", "user", "organization", "price"}
        )

        if not await authz.can(auth_subject.subject, AccessType.write, subscription):
            raise NotPermitted()

        if not subscription.active or subscription.cancel_at_period_end:
            raise AlreadyCanceledSubscription(subscription)

        if subscription.stripe_subscription_id is not None:
            stripe_service.cancel_subscription(subscription.stripe_subscription_id)
        else:
            subscription.ended_at = utc_now()
            subscription.cancel_at_period_end = True
            subscription.status = SubscriptionStatus.canceled

            # free subscriptions end immediately (vs at end of billing period)
            # queue removal of grants
            await self.enqueue_benefits_grants(session, subscription)

        session.add(subscription)

        await self._after_subscription_updated(session, subscription)

        return subscription

    async def get_statistics_periods(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        start_date: date,
        end_date: date,
        organization: Organization | None = None,
        types: list[SubscriptionTierType] | None = None,
        subscription_tier_id: uuid.UUID | None = None,
    ) -> list[SubscriptionsStatisticsPeriod]:
        if end_date > utc_now().date():
            raise EndDateInTheFuture(end_date)

        subscriptions_statement = self._get_readable_subscriptions_statement(
            auth_subject
        )

        if organization is not None:
            subscriptions_statement = subscriptions_statement.where(
                Product.organization_id == organization.id
            )

        if types is not None:
            subscriptions_statement = subscriptions_statement.where(
                Product.type.in_(types)
            )

        if subscription_tier_id is not None:
            subscriptions_statement = subscriptions_statement.where(
                Product.id == subscription_tier_id
            )

        # Set the interval to 1 month
        # Supporting dynamic interval is difficult for the cumulative column
        interval = text("interval 'P1M'")

        start_date_column = func.generate_series(
            start_date, end_date, interval
        ).column_valued("start_date")
        end_date_column = start_date_column + interval

        earnings_statement = (
            select(
                start_date_column,
                end_date_column,
                func.coalesce(
                    func.sum(Transaction.amount).filter(
                        Transaction.created_at >= start_date_column,
                        Transaction.created_at < end_date_column,
                    ),
                    0,
                ),
            )
            .join(
                Transaction,
                onclause=and_(
                    Transaction.type == TransactionType.balance,
                    Transaction.account_id.is_not(None),
                    Transaction.sale_id.in_(
                        select(Sale.id).where(
                            Sale.subscription_id.in_(
                                subscriptions_statement.with_only_columns(
                                    Subscription.id
                                )
                            )
                        )
                    ),
                ),
                isouter=True,
            )
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        subscriptions_join_clause = and_(
            Subscription.id.in_(
                subscriptions_statement.with_only_columns(Subscription.id)
            ),
            or_(
                and_(
                    or_(
                        start_date_column <= Subscription.ended_at,
                        Subscription.ended_at.is_(None),
                    ),
                    end_date_column >= Subscription.started_at,
                ),
                and_(
                    Subscription.started_at <= end_date_column,
                    or_(
                        Subscription.ended_at >= start_date_column,
                        Subscription.ended_at.is_(None),
                    ),
                ),
            ),
            # Exclude subscriptions that were active less than a month
            # This way, people who subscribe and unsubscribe right away are not counted
            # Mainly useful for the Free tier,
            # since paid tiers are canceled at the end of the period
            not_(
                and_(
                    Subscription.ended_at.is_not(None),
                    Subscription.started_at >= start_date_column,
                    Subscription.ended_at <= end_date_column,
                )
            ),
        )
        subscribers_count_statement = (
            select(start_date_column)
            .add_columns(
                end_date_column,
                # Trick to exclude counting of multiple subscription/unsubscription
                # that could happen with the Free tier.
                func.count(
                    distinct(
                        tuple_(
                            Subscription.subscriber_id,
                            Subscription.product_id,
                        )
                    )
                ).filter(Subscription.id.is_not(None)),
            )
            .join(Subscription, onclause=subscriptions_join_clause, isouter=True)
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        earnings_result = await session.execute(earnings_statement)
        earnings_results = earnings_result.all()

        subscribers_count_result = await session.execute(subscribers_count_statement)
        subscribers_counts = list(subscribers_count_result.tuples().all())

        statistics_periods: list[SubscriptionsStatisticsPeriod] = []

        for start_date, end_date, earnings in earnings_results:
            subscribers = subscribers_counts.pop(0)[2]
            statistics_periods.append(
                SubscriptionsStatisticsPeriod(
                    start_date=start_date,
                    end_date=end_date,
                    subscribers=subscribers,
                    earnings=earnings,
                )
            )

        return statistics_periods

    async def user_webhook_notifications(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        if subscription.price_id is None:
            return

        await session.refresh(subscription, {"product", "price"})
        assert subscription.price is not None

        webhooks = await webhook_notifications_service.search(
            session,
            organization_id=subscription.product.organization_id,
        )

        organization = await organization_service.get(
            session, subscription.product.organization_id
        )
        assert organization is not None

        subscription_tier = subscription.product
        price = subscription.price
        price_display = f"${price.price_amount / 100} / {price.recurring_interval}"

        description = (
            f"New subscription has been made to {organization.name} "
            f"on tier {subscription_tier.name}."
        )

        for wh in webhooks:
            if wh.integration == "discord":
                webhook = AsyncDiscordWebhook(url=wh.url, content="New Subscription")

                embed = DiscordEmbed(
                    title="New Subscription",
                    description=description,
                    color="65280",
                )

                embed.set_thumbnail(url=settings.THUMBNAIL_URL)
                embed.set_author(name="Polar.sh", icon_url=settings.FAVICON_URL)
                embed.add_embed_field(name="Price", value=price_display, inline=True)
                embed.set_footer(text="Powered by Polar.sh")

                webhook.add_embed(embed)
                await webhook.execute()
                continue

            if wh.integration == "slack":
                slack_webhook = SlackWebhookClient(wh.url)
                slack_webhook.send(
                    text=description,
                    blocks=[
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": description,
                            },
                            "accessory": {
                                "type": "button",
                                "text": {"type": "plain_text", "text": "Open"},
                                "url": f"https://polar.sh/{organization.name}",
                            },
                        },
                        {
                            "type": "section",
                            "fields": [
                                {
                                    "type": "mrkdwn",
                                    "text": f"*Price:*\n{price_display}",
                                },
                            ],
                        },
                    ],
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

    def _get_subscribed_subscriptions_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[Any]:
        user = auth_subject.subject
        return (
            select(Subscription)
            .join(
                UserOrganization,
                isouter=True,
                onclause=and_(
                    UserOrganization.organization_id == Subscription.organization_id,
                    UserOrganization.user_id == user.id,
                ),
            )
            .where(
                Subscription.deleted_at.is_(None),
                or_(
                    Subscription.user_id == user.id,
                    UserOrganization.user_id == user.id,
                ),
            )
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


subscription = SubscriptionService(Subscription)
