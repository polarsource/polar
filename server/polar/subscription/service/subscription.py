from datetime import UTC, datetime

import stripe as stripe_lib

from polar.enums import UserSignupType
from polar.exceptions import PolarError
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceServiceReader
from polar.models import Subscription, SubscriptionTier
from polar.user.service import user as user_service

from .subscription_tier import subscription_tier as subscription_tier_service


class SubscriptionError(PolarError):
    ...


class SubscriptionTierDoesNotExist(SubscriptionError):
    def __init__(self, subscription_id: str, product_id: str) -> None:
        self.subscription_id = subscription_id
        self.product_id = product_id
        message = (
            f"Received the subscription {subscription_id} from Stripe "
            f" with product {product_id}, but no associated SubscriptionTier exists."
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
            raise SubscriptionTierDoesNotExist(
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

        return await subscription.update(
            session,
            status=stripe_subscription.status,
            current_period_start=_from_timestamp(
                stripe_subscription.current_period_start
            ),
            current_period_end=_from_timestamp(stripe_subscription.current_period_end),
            cancel_at_period_end=stripe_subscription.cancel_at_period_end,
            ended_at=_from_timestamp(stripe_subscription.ended_at),
        )


subscription = SubscriptionService(Subscription)
