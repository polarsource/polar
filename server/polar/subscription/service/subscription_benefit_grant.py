from sqlalchemy import select

from polar.kit.services import ResourceServiceReader
from polar.models import Subscription, SubscriptionBenefit, SubscriptionBenefitGrant
from polar.postgres import AsyncSession
from polar.subscription.service.benefits import get_subscription_benefit_service


class SubscriptionBenefitGrantService(ResourceServiceReader[SubscriptionBenefitGrant]):
    async def grant_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit: SubscriptionBenefit,
    ) -> SubscriptionBenefitGrant:
        grant = await self._get_by_subscription_and_benefit(
            session, subscription, subscription_benefit
        )

        if grant is None:
            grant = SubscriptionBenefitGrant(
                subscription=subscription, subscription_benefit=subscription_benefit
            )
        elif grant.is_granted:
            return grant

        benefit_service = get_subscription_benefit_service(
            subscription_benefit.type, session
        )
        await benefit_service.grant(subscription_benefit)

        grant.set_granted()

        session.add(grant)
        await session.commit()

        return grant

    async def revoke_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit: SubscriptionBenefit,
    ) -> SubscriptionBenefitGrant:
        grant = await self._get_by_subscription_and_benefit(
            session, subscription, subscription_benefit
        )

        if grant is None:
            grant = SubscriptionBenefitGrant(
                subscription=subscription, subscription_benefit=subscription_benefit
            )
        elif grant.is_revoked:
            return grant

        benefit_service = get_subscription_benefit_service(
            subscription_benefit.type, session
        )
        await benefit_service.revoke(subscription_benefit)

        grant.set_revoked()

        session.add(grant)
        await session.commit()

        return grant

    async def _get_by_subscription_and_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit: SubscriptionBenefit,
    ) -> SubscriptionBenefitGrant | None:
        statement = select(SubscriptionBenefitGrant).where(
            SubscriptionBenefitGrant.subscription_id == subscription.id,
            SubscriptionBenefitGrant.subscription_benefit_id == subscription_benefit.id,
            SubscriptionBenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()


subscription_benefit_grant = SubscriptionBenefitGrantService(SubscriptionBenefitGrant)
