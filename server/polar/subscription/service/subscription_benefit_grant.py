from collections.abc import Sequence

import structlog
from sqlalchemy import select

from polar.benefit.benefits import BenefitPreconditionError, get_benefit_service
from polar.eventstream.service import publish as eventstream_publish
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import (
    Benefit,
    Subscription,
    SubscriptionBenefitGrant,
    SubscriptionTier,
    SubscriptionTierBenefit,
    User,
)
from polar.models.benefit import (
    BenefitProperties,
    BenefitType,
)
from polar.notifications.notification import (
    BenefitPreconditionErrorNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.user.service import user as user_service
from polar.worker import enqueue_job

log: Logger = structlog.get_logger()


class SubscriptionBenefitGrantService(ResourceServiceReader[SubscriptionBenefitGrant]):
    async def grant_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        user: User,
        benefit: Benefit,
        *,
        attempt: int = 1,
    ) -> SubscriptionBenefitGrant:
        log.info("Granting benefit", benefit_id=str(benefit.id), user_id=str(user.id))

        grant = await self.get_by_subscription_user_and_benefit(
            session, subscription, user, benefit
        )

        if grant is None:
            grant = SubscriptionBenefitGrant(
                subscription=subscription, user=user, benefit=benefit
            )
            session.add(grant)
        elif grant.is_granted:
            return grant

        benefit_service = get_benefit_service(benefit.type, session)
        try:
            properties = await benefit_service.grant(
                benefit,
                user,
                grant.properties,
                attempt=attempt,
            )
        except BenefitPreconditionError as e:
            await self.handle_precondition_error(
                session, e, subscription, user, benefit
            )
            grant.granted_at = None
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)
        await session.commit()

        await eventstream_publish(
            "subscription.subscription_benefit_grant.granted",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            user_id=user.id,
        )

        log.info(
            "Benefit granted",
            benefit_id=str(benefit.id),
            user_id=str(user.id),
            grant_id=str(grant.id),
        )

        return grant

    async def revoke_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        user: User,
        benefit: Benefit,
        *,
        attempt: int = 1,
    ) -> SubscriptionBenefitGrant:
        log.info("Revoking benefit", benefit_id=str(benefit.id), user_id=str(user.id))

        grant = await self.get_by_subscription_user_and_benefit(
            session, subscription, user, benefit
        )

        if grant is None:
            grant = SubscriptionBenefitGrant(
                subscription=subscription, user=user, benefit=benefit
            )
            session.add(grant)
        elif grant.is_revoked:
            return grant

        benefit_service = get_benefit_service(benefit.type, session)
        properties = await benefit_service.revoke(
            benefit,
            user,
            grant.properties,
            attempt=attempt,
        )

        grant.properties = properties
        grant.set_revoked()

        session.add(grant)
        await session.commit()

        await eventstream_publish(
            "subscription.subscription_benefit_grant.revoked",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            user_id=user.id,
        )

        log.info(
            "Benefit revoked",
            benefit_id=str(benefit.id),
            user_id=str(user.id),
            grant_id=str(grant.id),
        )

        return grant

    async def enqueue_benefit_grant_updates(
        self,
        session: AsyncSession,
        benefit: Benefit,
        previous_properties: BenefitProperties,
    ) -> None:
        benefit_service = get_benefit_service(benefit.type, session)
        if not await benefit_service.requires_update(benefit, previous_properties):
            return

        grants = await self._get_granted_by_benefit(session, benefit)
        for grant in grants:
            enqueue_job(
                "subscription.subscription_benefit.update",
                subscription_benefit_grant_id=grant.id,
            )

    async def update_benefit_grant(
        self,
        session: AsyncSession,
        grant: SubscriptionBenefitGrant,
        *,
        attempt: int = 1,
    ) -> SubscriptionBenefitGrant:
        # Don't update revoked benefits
        if grant.is_revoked:
            return grant

        await session.refresh(grant, {"subscription", "benefit"})
        subscription = grant.subscription
        benefit = grant.benefit

        user = await user_service.get(session, grant.user_id)
        assert user is not None

        benefit_service = get_benefit_service(benefit.type, session)
        try:
            properties = await benefit_service.grant(
                benefit,
                user,
                grant.properties,
                update=True,
                attempt=attempt,
            )
        except BenefitPreconditionError as e:
            await self.handle_precondition_error(
                session, e, subscription, user, benefit
            )
            grant.granted_at = None
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)

        return grant

    async def enqueue_benefit_grant_deletions(
        self, session: AsyncSession, benefit: Benefit
    ) -> None:
        grants = await self._get_granted_by_benefit(session, benefit)
        for grant in grants:
            enqueue_job(
                "subscription.subscription_benefit.delete",
                subscription_benefit_grant_id=grant.id,
            )

    async def delete_benefit_grant(
        self,
        session: AsyncSession,
        grant: SubscriptionBenefitGrant,
        *,
        attempt: int = 1,
    ) -> SubscriptionBenefitGrant:
        # Already revoked, nothing to do
        if grant.is_revoked:
            return grant

        await session.refresh(grant, {"subscription", "benefit"})
        benefit = grant.benefit

        user = await user_service.get(session, grant.user_id)
        assert user is not None

        benefit_service = get_benefit_service(benefit.type, session)
        properties = await benefit_service.revoke(
            benefit,
            user,
            grant.properties,
            attempt=attempt,
        )

        grant.properties = properties
        grant.set_revoked()

        session.add(grant)

        return grant

    async def handle_precondition_error(
        self,
        session: AsyncSession,
        error: BenefitPreconditionError,
        subscription: Subscription,
        user: User,
        benefit: Benefit,
    ) -> None:
        if error.payload is None:
            log.warning(
                "A precondition error was raised but the user was not notified. "
                "We probably should implement a notification for this error.",
                subscription_id=str(subscription.id),
                benefit_id=str(benefit.id),
            )
            return

        log.info(
            "Precondition error while granting subscription benefit. User was informed.",
            benefit_id=str(benefit.id),
            user_id=str(user.id),
        )

        await session.refresh(subscription, {"user", "subscription_tier"})
        subscription_tier = subscription.subscription_tier

        managing_organization = await organization_service.get(
            session, subscription_tier.managing_organization_id
        )
        assert managing_organization is not None

        notification_payload = BenefitPreconditionErrorNotificationPayload(
            subscription_id=subscription.id,
            subscription_tier_id=subscription_tier.id,
            subscription_tier_name=subscription_tier.name,
            benefit_id=benefit.id,
            benefit_description=benefit.description,
            organization_name=managing_organization.name,
            **error.payload.model_dump(),
        )

        await notification_service.send_to_user(
            session=session,
            user_id=user.id,
            notif=PartialNotification(
                type=NotificationType.benefit_precondition_error,
                payload=notification_payload,
            ),
        )

    async def enqueue_grants_after_precondition_fulfilled(
        self,
        session: AsyncSession,
        user: User,
        benefit_type: BenefitType,
    ) -> None:
        log.info(
            "Enqueueing subscription benefit grants after precondition fulfilled",
            user_id=str(user.id),
            benefit_type=benefit_type,
        )

        grants = await self._get_by_user_and_benefit_type(session, user, benefit_type)
        for grant in grants:
            if not grant.is_granted and not grant.is_revoked:
                enqueue_job(
                    "subscription.subscription_benefit.grant",
                    subscription_id=grant.subscription_id,
                    user_id=user.id,
                    benefit_id=grant.benefit_id,
                )

    async def get_outdated_grants(
        self,
        session: AsyncSession,
        subscription: Subscription,
        current_subscription_tier: SubscriptionTier,
    ) -> Sequence[SubscriptionBenefitGrant]:
        subscription_tier_benefits_statement = (
            select(Benefit.id)
            .join(SubscriptionTierBenefit)
            .where(
                SubscriptionTierBenefit.subscription_tier_id
                == current_subscription_tier.id
            )
        )

        statement = select(SubscriptionBenefitGrant).where(
            SubscriptionBenefitGrant.subscription_id == subscription.id,
            SubscriptionBenefitGrant.benefit_id.not_in(
                subscription_tier_benefits_statement
            ),
            SubscriptionBenefitGrant.is_granted.is_(True),
            SubscriptionBenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def get_by_subscription_user_and_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        user: User,
        benefit: Benefit,
    ) -> SubscriptionBenefitGrant | None:
        statement = select(SubscriptionBenefitGrant).where(
            SubscriptionBenefitGrant.subscription_id == subscription.id,
            SubscriptionBenefitGrant.user_id == user.id,
            SubscriptionBenefitGrant.benefit_id == benefit.id,
            SubscriptionBenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_granted_by_benefit(
        self, session: AsyncSession, benefit: Benefit
    ) -> Sequence[SubscriptionBenefitGrant]:
        statement = select(SubscriptionBenefitGrant).where(
            SubscriptionBenefitGrant.benefit_id == benefit.id,
            SubscriptionBenefitGrant.is_granted.is_(True),
            SubscriptionBenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_by_user_and_benefit_type(
        self,
        session: AsyncSession,
        user: User,
        benefit_type: BenefitType,
    ) -> Sequence[SubscriptionBenefitGrant]:
        statement = (
            select(SubscriptionBenefitGrant)
            .join(Benefit)
            .where(
                SubscriptionBenefitGrant.user_id == user.id,
                Benefit.type == benefit_type,
            )
        )

        result = await session.execute(statement)
        return result.scalars().all()


subscription_benefit_grant = SubscriptionBenefitGrantService(SubscriptionBenefitGrant)
