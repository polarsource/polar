import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any, cast, overload

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
from sqlalchemy.orm import aliased, contains_eager, joinedload

from polar.auth.dependencies import AuthMethod
from polar.authz.service import AccessType, Authz, Subject
from polar.benefit.service.benefit import benefit as benefit_service
from polar.benefit.service.benefit_grant import (
    benefit_grant as benefit_grant_service,
)
from polar.config import settings
from polar.enums import UserSignupType
from polar.exceptions import NotPermitted, PolarError, ResourceNotFound
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.models import (
    HeldBalance,
    OAuthAccount,
    Organization,
    Repository,
    Subscription,
    SubscriptionTier,
    SubscriptionTierPrice,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.models.transaction import TransactionType
from polar.models.user import OAuthPlatform
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerNewPaidSubscriptionNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.notifications.service import notifications as notifications_service
from polar.organization.service import organization as organization_service
from polar.posthog import posthog
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.user.service import user as user_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.webhook_notifications.service import webhook_notifications_service
from polar.worker import enqueue_job

from ..schemas import (
    FreeSubscriptionCreate,
    SubscriptionsStatisticsPeriod,
    SubscriptionUpgrade,
)
from .subscription_tier import subscription_tier as subscription_tier_service
from .subscription_tier_price import (
    subscription_tier_price as subscription_tier_price_service,
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
        organization_id: uuid.UUID | None = None,
        repository_id: uuid.UUID | None = None,
    ) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        self.repository_id = repository_id
        message = (
            "This user is already subscribed to one of the tier "
            "of this organization or repository."
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
            "or it doesn't belong to the same organization or repository."
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
    subscription_tier = "subscription_tier"


class SubscriptionService(ResourceServiceReader[Subscription]):
    async def get(
        self, session: AsyncSession, id: uuid.UUID, allow_deleted: bool = False
    ) -> Subscription | None:
        query = select(Subscription).where(Subscription.id == id)

        if not allow_deleted:
            query = query.where(Subscription.deleted_at.is_(None))

        query = query.options(
            joinedload(Subscription.user), joinedload(Subscription.organization)
        )

        res = await session.execute(query)
        return res.scalars().unique().one_or_none()

    async def search(
        self,
        session: AsyncSession,
        user: User,
        *,
        organization: Organization,
        repository: Repository | None = None,
        direct_organization: bool = True,
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
        statement = self._get_readable_subscriptions_statement(user).where(
            Subscription.started_at.is_not(None)
        )

        statement = statement.join(Subscription.user).join(
            Subscription.price, isouter=True
        )

        if organization is not None:
            clauses = [SubscriptionTier.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            statement = statement.where(or_(*clauses))

        if repository is not None:
            statement = statement.where(SubscriptionTier.repository_id == repository.id)

        if type is not None:
            statement = statement.where(SubscriptionTier.type == type)

        if subscription_tier_id is not None:
            statement = statement.where(SubscriptionTier.id == subscription_tier_id)

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
                    clause_function(SubscriptionTierPrice.price_amount).nulls_last()
                )
            if criterion == SearchSortProperty.subscription_tier_type:
                order_by_clauses.append(clause_function(SubscriptionTier.type))
            if criterion == SearchSortProperty.subscription_tier:
                order_by_clauses.append(clause_function(SubscriptionTier.name))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            contains_eager(Subscription.subscription_tier),
            contains_eager(Subscription.price),
            contains_eager(Subscription.user),
            joinedload(Subscription.organization),
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def search_subscribed(
        self,
        session: AsyncSession,
        user: User,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
        direct_organization: bool = True,
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
            self._get_subscribed_subscriptions_statement(user)
            .join(SubscriptionTier)
            .join(Subscription.price, isouter=True)
            .where(Subscription.started_at.is_not(None))
        )

        if organization is not None:
            clauses = [SubscriptionTier.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            statement = statement.where(or_(*clauses))

        if repository is not None:
            statement = statement.where(SubscriptionTier.repository_id == repository.id)

        if type is not None:
            statement = statement.where(SubscriptionTier.type == type)

        if subscription_tier_id is not None:
            statement = statement.where(SubscriptionTier.id == subscription_tier_id)

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
                    clause_function(SubscriptionTierPrice.price_amount)
                )
            if criterion == SearchSortProperty.subscription_tier_type:
                order_by_clauses.append(clause_function(SubscriptionTier.type))
            if criterion == SearchSortProperty.subscription_tier:
                order_by_clauses.append(clause_function(SubscriptionTier.name))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            contains_eager(Subscription.subscription_tier),
            contains_eager(Subscription.price),
            joinedload(Subscription.organization),
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def search_summary(
        self,
        session: AsyncSession,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Subscription], int]:
        statement = (
            (
                select(Subscription)
                .join(Subscription.subscription_tier)
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
                    contains_eager(Subscription.subscription_tier),
                    joinedload(Subscription.price),
                )
            )
            .where(Subscription.active.is_(True))
            .order_by(
                # Put users with a GitHub account first, so we can display their avatar
                OAuthAccount.created_at.desc().nulls_last(),
                Subscription.started_at.desc(),
            )
        )

        if organization is not None:
            statement = statement.where(
                SubscriptionTier.organization_id == organization.id
            )

        if repository is not None:
            statement = statement.where(SubscriptionTier.repository_id == repository.id)

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
        repository_id: uuid.UUID | None = None,
    ) -> list[Subscription]:
        statement = (
            select(Subscription)
            .join(Subscription.subscription_tier)
            .where(Subscription.user_id == user.id, Subscription.active.is_(True))
            .options(contains_eager(Subscription.subscription_tier))
        )

        if organization_id is not None:
            statement = statement.where(
                SubscriptionTier.organization_id == organization_id
            )

        if repository_id is not None:
            statement = statement.where(SubscriptionTier.repository_id == repository_id)

        result = await session.execute(statement)

        return list(result.scalars().all())

    async def create_free_subscription(
        self,
        session: AsyncSession,
        *,
        free_subscription_create: FreeSubscriptionCreate,
        auth_subject: Subject,
        auth_method: AuthMethod | None,
        signup_type: UserSignupType = UserSignupType.backer,
    ) -> Subscription:
        subscription_tier = await subscription_tier_service.get(
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
        if isinstance(auth_subject, User) and auth_method == AuthMethod.COOKIE:
            user = auth_subject
        else:
            if free_subscription_create.customer_email is None:
                raise RequiredCustomerEmail()
            user = await user_service.get_by_email_or_signup(
                session,
                email=free_subscription_create.customer_email,
                signup_type=signup_type,
            )

        return await self.create_arbitrary_subscription(
            session, user=user, subscription_tier=subscription_tier
        )

    async def create_arbitrary_subscription(
        self,
        session: AsyncSession,
        *,
        user: User,
        subscription_tier: SubscriptionTier,
        price: SubscriptionTierPrice | None = None,
    ) -> Subscription:
        existing_subscriptions = await self.get_active_user_subscriptions(
            session,
            user,
            organization_id=subscription_tier.organization_id,
            repository_id=subscription_tier.repository_id,
        )
        if len(existing_subscriptions) > 0:
            raise AlreadySubscribed(
                user_id=user.id,
                organization_id=subscription_tier.organization_id,
                repository_id=subscription_tier.repository_id,
            )

        start = utc_now()
        subscription = Subscription(
            status=SubscriptionStatus.active,
            current_period_start=start,
            cancel_at_period_end=False,
            started_at=start,
            user=user,
            organization=None,
            subscription_tier=subscription_tier,
            price=price,
        )
        session.add(subscription)
        await session.flush()

        enqueue_job(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )

        return subscription

    async def create_subscription_from_stripe(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        price_id = stripe_subscription["items"].data[0].price.id
        price = await subscription_tier_price_service.get_by_stripe_price_id(
            session, price_id
        )
        if price is None:
            raise AssociatedSubscriptionTierPriceDoesNotExist(
                stripe_subscription.id, price_id
            )

        subscription_tier = price.subscription_tier
        subscription_tier_org = await organization_service.get(
            session, subscription_tier.managing_organization_id
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
        subscription.subscription_tier = subscription_tier

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

        return subscription

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
        price = await subscription_tier_price_service.get_by_stripe_price_id(
            session, price_id
        )
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

        enqueue_job(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )

        return subscription

    async def transfer_subscription_paid_invoice(
        self,
        session: AsyncSession,
        *,
        invoice: stripe_lib.Invoice,
    ) -> None:
        assert invoice.charge is not None

        if invoice.subscription is None:
            return

        stripe_subscription_id = get_expandable_id(invoice.subscription)
        subscription = await self.get_by_stripe_subscription_id(
            session, stripe_subscription_id
        )
        if subscription is None:
            raise SubscriptionDoesNotExist(stripe_subscription_id)

        await session.refresh(subscription, {"subscription_tier", "price"})
        account = await subscription_tier_service.get_managing_organization_account(
            session, subscription.subscription_tier
        )

        tax = invoice.tax or 0
        transfer_amount = invoice.total - tax

        charge_id = get_expandable_id(invoice.charge)

        # Prepare an held balance
        # It'll be used if the account is not created yet
        payment_transaction = await balance_transaction_service.get_by(
            session, type=TransactionType.payment, charge_id=charge_id
        )
        if payment_transaction is None:
            raise PaymentTransactionForChargeDoesNotExist(charge_id)
        held_balance = HeldBalance(
            amount=transfer_amount,
            subscription=subscription,
            subscription_tier_price=subscription.price,
            payment_transaction=payment_transaction,
        )

        # No account, create the held balance
        if account is None:
            managing_organization = await organization_service.get(
                session, subscription.subscription_tier.managing_organization_id
            )
            assert managing_organization is not None
            held_balance.organization_id = managing_organization.id
            await held_balance_service.create(session, held_balance=held_balance)

            await notification_service.send_to_org_admins(
                session=session,
                org_id=managing_organization.id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_create_account,
                    payload=MaintainerCreateAccountNotificationPayload(
                        organization_name=managing_organization.name,
                        url=managing_organization.account_url,
                    ),
                ),
            )

            return

        # Account created, create the balance immediately
        balance_transactions = (
            await balance_transaction_service.create_balance_from_charge(
                session,
                source_account=None,
                destination_account=account,
                charge_id=charge_id,
                amount=transfer_amount,
                subscription=subscription,
            )
        )
        await platform_fee_transaction_service.create_fees_reversal_balances(
            session, balance_transactions=balance_transactions
        )

    async def enqueue_benefits_grants(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        subscription_tier = await subscription_tier_service.get(
            session, subscription.subscription_tier_id
        )
        assert subscription_tier is not None

        if subscription.is_incomplete():
            return

        # Get granted benefits that are not part of this tier.
        # It happens if the subscription has been upgraded/downgraded.
        outdated_grants = await benefit_grant_service.get_outdated_grants(
            session, subscription, subscription_tier
        )

        # Grant to all members of the organization if any, or the user
        users_ids: list[uuid.UUID] = []
        if subscription.organization_id is not None:
            members = await user_organization_service.list_by_org(
                session, subscription.organization_id
            )
            users_ids = [member.user_id for member in members]
        else:
            users_ids = [subscription.user_id]

        task = "grant" if subscription.active else "revoke"
        for benefit in subscription_tier.benefits:
            # FIXME: Hack to prevent GitHub Repository benefit abuse
            # Only enqueue it for the subscriber user.
            # Remove this when we have proper per-seat support
            if benefit.type == BenefitType.github_repository:
                enqueue_job(
                    f"subscription.subscription_benefit.{task}",
                    subscription_id=subscription.id,
                    user_id=subscription.user_id,
                    benefit_id=benefit.id,
                )
            else:
                for user_id in users_ids:
                    enqueue_job(
                        f"subscription.subscription_benefit.{task}",
                        subscription_id=subscription.id,
                        user_id=user_id,
                        benefit_id=benefit.id,
                    )

        for user_id in users_ids:
            for outdated_grant in outdated_grants:
                enqueue_job(
                    "subscription.subscription_benefit.revoke",
                    subscription_id=subscription.id,
                    user_id=user_id,
                    benefit_id=outdated_grant.benefit_id,
                )

            # Special hard-coded logic to make sure
            # we always at least subscribe to public articles
            if subscription_tier.get_articles_benefit() is None:
                await session.refresh(subscription_tier, {"organization", "repository"})
                (
                    free_articles_benefit,
                    _,
                ) = await benefit_service.get_or_create_articles_benefits(
                    session,
                    subscription_tier.organization,
                    subscription_tier.repository,
                )
                enqueue_job(
                    f"subscription.subscription_benefit.{task}",
                    subscription_id=subscription.id,
                    user_id=user_id,
                    subscription_benefit_id=free_articles_benefit.id,
                )

    async def update_subscription_tier_benefits_grants(
        self, session: AsyncSession, subscription_tier: SubscriptionTier
    ) -> None:
        statement = select(Subscription).where(
            Subscription.subscription_tier_id == subscription_tier.id,
            Subscription.deleted_at.is_(None),
        )
        subscriptions = await session.stream_scalars(statement)
        async for subscription in subscriptions:
            enqueue_job(
                "subscription.subscription.enqueue_benefits_grants", subscription.id
            )

    async def update_organization_benefits_grants(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        statement = select(Subscription).where(
            Subscription.organization_id == organization.id,
            Subscription.deleted_at.is_(None),
        )
        subscriptions = await session.stream_scalars(statement)
        async for subscription in subscriptions:
            enqueue_job(
                "subscription.subscription.enqueue_benefits_grants", subscription.id
            )

    async def upgrade_subscription(
        self,
        session: AsyncSession,
        *,
        subscription: Subscription,
        subscription_upgrade: SubscriptionUpgrade,
        authz: Authz,
        user: User,
    ) -> Subscription:
        if not await authz.can(user, AccessType.write, subscription):
            raise NotPermitted()

        await session.refresh(
            subscription, {"subscription_tier", "user", "organization", "price"}
        )

        if subscription.subscription_tier.type == SubscriptionTierType.free:
            raise FreeSubscriptionUpgrade(subscription)

        new_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_upgrade.subscription_tier_id
        )

        if new_subscription_tier is None:
            raise InvalidSubscriptionTierUpgrade(
                subscription_upgrade.subscription_tier_id
            )

        # Make sure the new tier belongs to the same organization/repository
        old_subscription_tier = subscription.subscription_tier
        if (
            old_subscription_tier.organization_id
            and old_subscription_tier.organization_id
            != new_subscription_tier.organization_id
        ) or (
            old_subscription_tier.repository_id
            and old_subscription_tier.repository_id
            != new_subscription_tier.repository_id
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

        subscription.subscription_tier = new_subscription_tier
        subscription.price = new_price
        session.add(subscription)

        return subscription

    async def cancel_subscription(
        self,
        session: AsyncSession,
        *,
        subscription: Subscription,
        authz: Authz,
        user: User,
    ) -> Subscription:
        await session.refresh(
            subscription, {"subscription_tier", "user", "organization", "price"}
        )

        if not await authz.can(user, AccessType.write, subscription):
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
            enqueue_job(
                "subscription.subscription.enqueue_benefits_grants", subscription.id
            )

        session.add(subscription)

        return subscription

    async def get_statistics_periods(
        self,
        session: AsyncSession,
        user: User,
        *,
        start_date: date,
        end_date: date,
        organization: Organization | None = None,
        repository: Repository | None = None,
        direct_organization: bool = True,
        types: list[SubscriptionTierType] | None = None,
        subscription_tier_id: uuid.UUID | None = None,
    ) -> list[SubscriptionsStatisticsPeriod]:
        if end_date > utc_now().date():
            raise EndDateInTheFuture(end_date)

        subscriptions_statement = self._get_readable_subscriptions_statement(user)

        if organization is not None:
            clauses = [SubscriptionTier.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            subscriptions_statement = subscriptions_statement.where(or_(*clauses))

        if repository is not None:
            subscriptions_statement = subscriptions_statement.where(
                SubscriptionTier.repository_id == repository.id
            )

        if types is not None:
            subscriptions_statement = subscriptions_statement.where(
                SubscriptionTier.type.in_(types)
            )

        if subscription_tier_id is not None:
            subscriptions_statement = subscriptions_statement.where(
                SubscriptionTier.id == subscription_tier_id
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
                    Transaction.subscription_id.in_(
                        subscriptions_statement.with_only_columns(Subscription.id)
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
                            Subscription.subscription_tier_id,
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

        await session.refresh(subscription, {"subscription_tier", "price"})
        assert subscription.price is not None

        webhooks = await webhook_notifications_service.search(
            session,
            organization_id=subscription.subscription_tier.managing_organization_id,
        )

        organization = await organization_service.get(
            session, subscription.subscription_tier.managing_organization_id
        )
        assert organization is not None

        subscription_tier = subscription.subscription_tier
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

    def _get_readable_subscriptions_statement(self, user: User) -> Select[Any]:
        statement = (
            select(Subscription)
            .join(Subscription.subscription_tier)
            .join(
                Repository,
                onclause=SubscriptionTier.repository_id == Repository.id,
                isouter=True,
            )
        )

        RepositoryUserOrganization = aliased(UserOrganization)

        return (
            statement.join(
                UserOrganization,
                isouter=True,
                onclause=and_(
                    UserOrganization.organization_id
                    == SubscriptionTier.organization_id,
                    UserOrganization.user_id == user.id,
                ),
            )
            .join(
                RepositoryUserOrganization,
                isouter=True,
                onclause=and_(
                    RepositoryUserOrganization.organization_id
                    == Repository.organization_id,
                    RepositoryUserOrganization.user_id == user.id,
                ),
            )
            .where(
                Subscription.deleted_at.is_(None),
                or_(
                    UserOrganization.user_id == user.id,
                    RepositoryUserOrganization.user_id == user.id,
                ),
            )
        )

    def _get_subscribed_subscriptions_statement(self, user: User) -> Select[Any]:
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


subscription = SubscriptionService(Subscription)
