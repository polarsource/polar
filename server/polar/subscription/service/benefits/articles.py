import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select

from polar.models import (
    ArticlesSubscription,
    Subscription,
    SubscriptionBenefit,
    SubscriptionBenefitGrant,
    User,
)
from polar.models.subscription_benefit import (
    SubscriptionBenefitArticles,
    SubscriptionBenefitType,
)

from ...schemas import SubscriptionBenefitArticlesUpdate
from .base import SubscriptionBenefitServiceProtocol


class SubscriptionBenefitArticlesService(
    SubscriptionBenefitServiceProtocol[
        SubscriptionBenefitArticles, SubscriptionBenefitArticlesUpdate
    ]
):
    async def grant(
        self,
        benefit: SubscriptionBenefitArticles,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        update: bool = False,
        attempt: int = 1,
    ) -> dict[str, Any]:
        await self.session.refresh(subscription, {"subscription_tier"})
        organization_id = subscription.subscription_tier.managing_organization_id

        articles_subscription = await self._get_articles_subscription(
            user.id, organization_id
        )
        if articles_subscription is None:
            articles_subscription = ArticlesSubscription(
                user_id=user.id, organization_id=organization_id
            )

        articles_subscription.deleted_at = None
        articles_subscription.paid_subscriber = benefit.properties["paid_articles"]
        self.session.add(articles_subscription)
        await self.session.commit()

        return {}

    async def revoke(
        self,
        benefit: SubscriptionBenefitArticles,
        subscription: Subscription,
        user: User,
        grant_properties: dict[str, Any],
        *,
        attempt: int = 1,
    ) -> dict[str, Any]:
        await self.session.refresh(subscription, {"subscription_tier"})
        organization_id = subscription.subscription_tier.managing_organization_id

        articles_subscription = await self._get_articles_subscription(
            user.id, organization_id
        )
        if articles_subscription is not None:
            # Revoke only if there are no other grant giving access to those articles
            # Possible in case of Free -> Premium upgrade or multiple subscriptions
            articles_grants = await self._get_articles_grants(user.id, organization_id)
            if len(articles_grants) == 1:
                await self.session.delete(articles_subscription)
                await self.session.commit()

        return {}

    async def requires_update(
        self,
        benefit: SubscriptionBenefitArticles,
        update: SubscriptionBenefitArticlesUpdate,
    ) -> bool:
        return False

    async def _get_articles_subscription(
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> ArticlesSubscription | None:
        statement = select(ArticlesSubscription).where(
            ArticlesSubscription.user_id == user_id,
            ArticlesSubscription.organization_id == organization_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_articles_grants(
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> Sequence[SubscriptionBenefitGrant]:
        statement = (
            select(SubscriptionBenefitGrant)
            .join(SubscriptionBenefitGrant.subscription_benefit)
            .where(
                SubscriptionBenefitGrant.user_id == user_id,
                SubscriptionBenefitGrant.is_granted.is_(True),
                SubscriptionBenefit.type == SubscriptionBenefitType.articles,
                SubscriptionBenefit.organization_id == organization_id,
            )
        )
        result = await self.session.execute(statement)
        return result.scalars().all()
