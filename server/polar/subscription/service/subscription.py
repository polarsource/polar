import math
import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any, cast, overload

import stripe as stripe_lib
from sqlalchemy import Select, UnaryExpression, and_, asc, desc, func, or_, select, text
from sqlalchemy.orm import aliased, contains_eager, joinedload

from polar.auth.dependencies import AuthMethod
from polar.authz.service import AccessType, Authz, Subject
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
    Organization,
    Repository,
    Subscription,
    SubscriptionTier,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.models.transaction import TransactionType
from polar.organization.service import organization as organization_service
from polar.transaction.service.transfer import (
    transfer_transaction as transfer_transaction_service,
)
from polar.user.service import user as user_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from ..schemas import (
    FreeSubscriptionCreate,
    SubscriptionsStatisticsPeriod,
    SubscriptionUpgrade,
)
from .subscription_benefit import subscription_benefit as subscription_benefit_service
from .subscription_benefit_grant import (
    subscription_benefit_grant as subscription_benefit_grant_service,
)
from .subscription_tier import subscription_tier as subscription_tier_service


class SubscriptionError(PolarError):
    ...


class AssociatedSubscriptionTierDoesNotExist(SubscriptionError):
    def __init__(self, stripe_subscription_id: str, stripe_product_id: str) -> None:
        self.subscription_id = stripe_subscription_id
        self.product_id = stripe_product_id
        message = (
            f"Received the subscription {stripe_subscription_id} from Stripe "
            f"with product {stripe_product_id}, "
            "but no associated SubscriptionTier exists."
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
            "You're already subscribed to one of the tier "
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


@overload
def _from_timestamp(t: int) -> datetime:
    ...


@overload
def _from_timestamp(t: None) -> None:
    ...


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
    async def search(
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
        statement = self._get_readable_subscriptions_statement(user).where(
            Subscription.started_at.is_not(None)
        )

        statement = statement.join(Subscription.user)

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
                order_by_clauses.append(clause_function(Subscription.price_amount))
            if criterion == SearchSortProperty.subscription_tier_type:
                order_by_clauses.append(clause_function(SubscriptionTier.type))
            if criterion == SearchSortProperty.subscription_tier:
                order_by_clauses.append(clause_function(SubscriptionTier.name))
        statement = statement.order_by(*order_by_clauses)

        statement = statement.options(
            contains_eager(Subscription.subscription_tier),
            contains_eager(Subscription.user),
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
            select(Subscription)
            .join(Subscription.subscription_tier)
            .options(
                joinedload(Subscription.user),
                joinedload(Subscription.organization),
                contains_eager(Subscription.subscription_tier),
            )
        ).where(Subscription.active.is_(True))

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
                signup_type=UserSignupType.backer,
            )

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
        subscription = await self.model.create(
            session,
            status=SubscriptionStatus.active,
            current_period_start=start,
            cancel_at_period_end=False,
            started_at=start,
            price_currency=subscription_tier.price_currency,
            price_amount=subscription_tier.price_amount,
            user=user,
            organization=None,
            subscription_tier=subscription_tier,
        )

        await enqueue_job(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )

        return subscription

    async def create_subscription(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        price = stripe_subscription["items"].data[0].price
        product_id = price.product
        subscription_tier = await subscription_tier_service.get_by_stripe_product_id(
            session, product_id
        )
        if subscription_tier is None:
            raise AssociatedSubscriptionTierDoesNotExist(
                stripe_subscription.id, product_id
            )
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
        subscription.price_currency = price.currency
        subscription.price_amount = price.unit_amount
        subscription.subscription_tier_id = subscription_tier.id

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
        await session.commit()

        return subscription

    async def update_subscription(
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

        session.add(subscription)
        await session.commit()

        await enqueue_job(
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

        await session.refresh(subscription, {"subscription_tier"})
        account = await subscription_tier_service.get_managing_organization_account(
            session, subscription.subscription_tier
        )
        assert account is not None

        tax = invoice.tax or 0
        transfer_amount = math.floor(
            (invoice.total - tax) * ((100 - settings.SUBSCRIPTION_FEE_PERCENT) / 100)
        )
        transfer_metadata: dict[str, str] = {
            "subscription_id": str(subscription.id),
            "organization_id": str(
                subscription.subscription_tier.managing_organization_id
            ),
            "stripe_subscription_id": subscription.stripe_subscription_id,
            "stripe_product_id": cast(
                str, subscription.subscription_tier.stripe_product_id
            ),
        }
        invoice_metadata: dict[str, str] = {
            "transferred_at": str(int(utc_now().timestamp())),
        }

        incoming, _ = await transfer_transaction_service.create_transfer_from_charge(
            session,
            destination_account=account,
            charge_id=get_expandable_id(invoice.charge),
            amount=transfer_amount,
            subscription=subscription,
            transfer_metadata=transfer_metadata,
        )

        invoice_metadata["transfer_id"] = cast(str, incoming.transfer_id)
        assert invoice.id is not None
        stripe_service.update_invoice(invoice.id, metadata=invoice_metadata)

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
        outdated_grants = await subscription_benefit_grant_service.get_outdated_grants(
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

        for user_id in users_ids:
            task = "grant" if subscription.active else "revoke"
            for benefit in subscription_tier.benefits:
                await enqueue_job(
                    f"subscription.subscription_benefit.{task}",
                    subscription_id=subscription.id,
                    user_id=user_id,
                    subscription_benefit_id=benefit.id,
                )

            for outdated_grant in outdated_grants:
                await enqueue_job(
                    "subscription.subscription_benefit.revoke",
                    subscription_id=subscription.id,
                    user_id=user_id,
                    subscription_benefit_id=outdated_grant.subscription_benefit_id,
                )

            # Special hard-coded logic to make sure
            # we always at least subscribe to public articles
            if subscription_tier.get_articles_benefit() is None:
                await session.refresh(subscription_tier, {"organization", "repository"})
                (
                    free_articles_benefit,
                    _,
                ) = await subscription_benefit_service.get_or_create_articles_benefits(
                    session,
                    subscription_tier.organization,
                    subscription_tier.repository,
                )
                await enqueue_job(
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
            await enqueue_job(
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
            await enqueue_job(
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
            subscription, {"subscription_tier", "user", "organization"}
        )

        if subscription.subscription_tier.type == SubscriptionTierType.free:
            raise FreeSubscriptionUpgrade(subscription)

        new_subscription_tier = await subscription_tier_service.get_by_id(
            session, user, subscription_upgrade.subscription_tier_id
        )

        if (
            new_subscription_tier is None
            or new_subscription_tier.stripe_price_id is None
        ):
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

        assert old_subscription_tier.stripe_price_id is not None
        stripe_service.update_subscription_price(
            subscription.stripe_subscription_id,
            old_price=old_subscription_tier.stripe_price_id,
            new_price=new_subscription_tier.stripe_price_id,
        )

        subscription.subscription_tier = new_subscription_tier
        subscription.price_currency = new_subscription_tier.price_currency
        subscription.price_amount = new_subscription_tier.price_amount
        session.add(subscription)
        await session.commit()

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
            subscription, {"subscription_tier", "user", "organization"}
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
            await enqueue_job(
                "subscription.subscription.enqueue_benefits_grants", subscription.id
            )

        session.add(subscription)
        await session.commit()

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
        type: SubscriptionTierType | None = None,
        subscription_tier_id: uuid.UUID | None = None,
        current_start_of_month: date | None = None,
    ) -> list[SubscriptionsStatisticsPeriod]:
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

        if type is not None:
            subscriptions_statement = subscriptions_statement.where(
                SubscriptionTier.type == type
            )

        if subscription_tier_id is not None:
            subscriptions_statement = subscriptions_statement.where(
                SubscriptionTier.id == subscription_tier_id
            )

        current_start_of_month = current_start_of_month or utc_now().date().replace(
            day=1
        )

        # Set the interval to 1 month
        # Supporting dynamic interval is difficult for the cumulative column
        interval = text("interval 'P1M'")

        start_date_column = func.generate_series(
            start_date, end_date, interval
        ).column_valued("start_date")
        end_date_column = start_date_column + interval

        # Rely on transactions for past months
        past_cumulative_column = func.coalesce(
            func.sum(func.sum(Transaction.amount))
            # ORDER_BY makes the window implicitly stops at the current row
            .over(order_by=start_date_column),
            0,
        )
        past_statement = (
            select(start_date_column)
            .add_columns(
                end_date_column,
                func.count(Transaction.subscription_id),
                func.coalesce(func.sum(Transaction.amount), 0),
                past_cumulative_column,
            )
            .join(
                Transaction,
                onclause=and_(
                    Transaction.type == TransactionType.transfer,
                    Transaction.account_id.is_not(None),
                    Transaction.created_at < end_date_column,
                    Transaction.created_at >= start_date_column,
                    Transaction.subscription_id.in_(
                        subscriptions_statement.with_only_columns(Subscription.id)
                    ),
                ),
                isouter=True,
            )
            .where(start_date_column < current_start_of_month)
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        # Estimate based on active subscriptions for future months
        future_cumulative_column = func.coalesce(
            func.sum(func.sum(Subscription.price_amount))
            # ORDER_BY makes the window implicitly stops at the current row
            .over(order_by=start_date_column),
            0,
        )

        after_fee_amount_percentage = 1 - settings.SUBSCRIPTION_FEE_PERCENT / 100

        future_statement = (
            select(start_date_column)
            .add_columns(
                end_date_column,
                func.count(Subscription.id),
                func.coalesce(
                    func.sum(Subscription.price_amount) * after_fee_amount_percentage,
                    0,
                ),
                future_cumulative_column * after_fee_amount_percentage,
            )
            .join(
                Subscription,
                onclause=and_(
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
                ),
                isouter=True,
            )
            .where(start_date_column >= current_start_of_month)
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        past_result = await session.execute(past_statement)
        future_result = await session.execute(future_statement)

        statistics_periods = [
            SubscriptionsStatisticsPeriod(
                start_date=start_date,
                end_date=end_date,
                subscribers=subscribers,
                mrr=mrr,
                cumulative=cumulative,
            )
            for (
                start_date,
                end_date,
                subscribers,
                mrr,
                cumulative,
            ) in past_result.all()
        ]
        last_past_cumulative = statistics_periods[-1].cumulative
        statistics_periods += [
            SubscriptionsStatisticsPeriod(
                start_date=start_date,
                end_date=end_date,
                subscribers=subscribers,
                mrr=mrr,
                cumulative=cumulative + last_past_cumulative,
            )
            for (
                start_date,
                end_date,
                subscribers,
                mrr,
                cumulative,
            ) in future_result.all()
        ]

        return statistics_periods

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
                    Subscription.user_id == user.id,
                    UserOrganization.user_id == user.id,
                    RepositoryUserOrganization.user_id == user.id,
                ),
            )
        )


subscription = SubscriptionService(Subscription)
