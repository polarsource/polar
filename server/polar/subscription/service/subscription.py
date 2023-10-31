import uuid
from datetime import UTC, date, datetime
from typing import Any, overload

import stripe as stripe_lib
from sqlalchemy import Select, and_, func, or_, select, text
from sqlalchemy.orm import aliased

from polar.enums import UserSignupType
from polar.exceptions import PolarError
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceServiceReader
from polar.models import (
    Organization,
    Repository,
    Subscription,
    SubscriptionTier,
    User,
    UserOrganization,
)
from polar.models.subscription_tier import SubscriptionTierType
from polar.user.service import user as user_service
from polar.worker import enqueue_job

from ..schemas import SubscriptionsSummaryPeriod
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


class SubscriptionService(ResourceServiceReader[Subscription]):
    async def get_by_stripe_subscription_id(
        self, session: AsyncSession, stripe_subscription_id: str
    ) -> Subscription | None:
        return await self.get_by(session, stripe_subscription_id=stripe_subscription_id)

    async def create_subscription(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        customer_id = stripe_subscription.customer

        price = stripe_subscription["items"].data[0].price
        product_id = price.product
        subscription_tier = await subscription_tier_service.get_by_stripe_product_id(
            session, product_id
        )
        if subscription_tier is None:
            raise AssociatedSubscriptionTierDoesNotExist(
                stripe_subscription.stripe_id, product_id
            )

        user = await user_service.get_by_stripe_customer_id(session, customer_id)
        if user is None:
            customer = stripe_service.get_customer(customer_id)
            user = await user_service.get_by_email_or_signup(
                session, customer.email, signup_type=UserSignupType.backer
            )
            user.stripe_customer_id = customer_id
            session.add(user)
        await loops_service.user_update(user, isBacker=True)

        subscription = Subscription(
            stripe_subscription_id=stripe_subscription.stripe_id,
            status=stripe_subscription.status,
            current_period_start=_from_timestamp(
                stripe_subscription.current_period_start
            ),
            current_period_end=_from_timestamp(stripe_subscription.current_period_end),
            cancel_at_period_end=stripe_subscription.cancel_at_period_end,
            ended_at=_from_timestamp(stripe_subscription.ended_at),
            price_currency=price.currency,
            price_amount=price.unit_amount,
            user_id=user.id,
            subscription_tier_id=subscription_tier.id,
        )
        subscription.set_started_at()
        session.add(subscription)

        await session.commit()

        return subscription

    async def update_subscription(
        self, session: AsyncSession, *, stripe_subscription: stripe_lib.Subscription
    ) -> Subscription:
        subscription = await self.get_by_stripe_subscription_id(
            session, stripe_subscription.stripe_id
        )

        if subscription is None:
            raise SubscriptionDoesNotExist(stripe_subscription.stripe_id)

        subscription.status = stripe_subscription.status
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
            "subscription.subscription.enqueue_benefits_grants",
            subscription.id,
        )

        return subscription

    async def enqueue_benefits_grants(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        subscription_tier = await subscription_tier_service.get(
            session, subscription.subscription_tier_id
        )
        assert subscription_tier is not None

        if subscription.is_incomplete():
            return

        task = "grant" if subscription.is_active() else "revoke"
        for benefit in subscription_tier.benefits:
            await enqueue_job(
                f"subscription.subscription_benefit.{task}",
                subscription_id=subscription.id,
                subscription_benefit_id=benefit.id,
            )

    async def get_periods_summary(
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
    ) -> list[SubscriptionsSummaryPeriod]:
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

        # Set the interval to 1 month
        # Supporting dynamic interval is difficult for the cumulative column
        interval = text("interval 'P1M'")

        start_date_column = func.generate_series(
            start_date, end_date, interval
        ).column_valued("start_date")
        end_date_column = start_date_column + interval

        cumulative_column = func.coalesce(
            func.sum(func.sum(Subscription.price_amount))
            # ORDER_BY makes the window implicitly stops at the current row
            .over(order_by=start_date_column),
            0,
        )

        statement = (
            select(start_date_column)
            .add_columns(
                end_date_column,
                func.count(Subscription.id),
                func.coalesce(func.sum(Subscription.price_amount), 0),
                cumulative_column,
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
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        result = await session.execute(statement)

        return [
            SubscriptionsSummaryPeriod(
                start_date=start_date,
                end_date=end_date,
                subscribers=subscribers,
                mrr=mrr,
                cumulative=cumulative,
            )
            for (start_date, end_date, subscribers, mrr, cumulative) in result.all()
        ]

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


subscription = SubscriptionService(Subscription)
