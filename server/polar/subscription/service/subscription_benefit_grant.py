from collections.abc import Sequence

import structlog
from sqlalchemy import select

from polar.email.renderer import get_email_renderer
from polar.email.sender import get_email_sender
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import Subscription, SubscriptionBenefit, SubscriptionBenefitGrant
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from ..schemas import SubscriptionBenefitUpdate
from .benefits import (
    SubscriptionBenefitPreconditionError,
    get_subscription_benefit_service,
)

log: Logger = structlog.get_logger()


class SubscriptionBenefitGrantService(ResourceServiceReader[SubscriptionBenefitGrant]):
    async def grant_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit: SubscriptionBenefit,
        *,
        attempt: int = 1,
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
        try:
            await benefit_service.grant(
                subscription_benefit, subscription, attempt=attempt
            )
        except SubscriptionBenefitPreconditionError as e:
            await self.handle_precondition_error(
                session, e, subscription, subscription_benefit
            )
            grant.granted_at = None
        else:
            grant.set_granted()

        session.add(grant)
        await session.commit()

        return grant

    async def revoke_benefit(
        self,
        session: AsyncSession,
        subscription: Subscription,
        subscription_benefit: SubscriptionBenefit,
        *,
        attempt: int = 1,
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
        await benefit_service.revoke(
            subscription_benefit, subscription, attempt=attempt
        )

        grant.set_revoked()

        session.add(grant)
        await session.commit()

        return grant

    async def enqueue_benefit_grant_updates(
        self,
        session: AsyncSession,
        subscription_benefit: SubscriptionBenefit,
        update_schema: SubscriptionBenefitUpdate,
    ) -> None:
        benefit_service = get_subscription_benefit_service(
            subscription_benefit.type, session
        )
        if not await benefit_service.requires_update(
            subscription_benefit, update_schema
        ):
            return

        grants = await self._get_granted_by_benefit(session, subscription_benefit)
        for grant in grants:
            await enqueue_job(
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

        await session.refresh(grant, {"subscription", "subscription_benefit"})
        subscription = grant.subscription
        subscription_benefit = grant.subscription_benefit

        benefit_service = get_subscription_benefit_service(
            subscription_benefit.type, session
        )
        try:
            await benefit_service.grant(
                subscription_benefit, subscription, attempt=attempt
            )
        except SubscriptionBenefitPreconditionError as e:
            await self.handle_precondition_error(
                session, e, subscription, subscription_benefit
            )
            grant.granted_at = None
        else:
            grant.set_granted()

        session.add(grant)
        await session.commit()

        return grant

    async def enqueue_benefit_grant_deletions(
        self, session: AsyncSession, subscription_benefit: SubscriptionBenefit
    ) -> None:
        grants = await self._get_granted_by_benefit(session, subscription_benefit)
        for grant in grants:
            await enqueue_job(
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

        await session.refresh(grant, {"subscription", "subscription_benefit"})
        subscription = grant.subscription
        subscription_benefit = grant.subscription_benefit

        benefit_service = get_subscription_benefit_service(
            subscription_benefit.type, session
        )
        await benefit_service.revoke(
            subscription_benefit, subscription, attempt=attempt
        )

        grant.set_revoked()

        session.add(grant)
        await session.commit()

        return grant

    async def handle_precondition_error(
        self,
        session: AsyncSession,
        error: SubscriptionBenefitPreconditionError,
        subscription: Subscription,
        subscription_benefit: SubscriptionBenefit,
    ) -> None:
        if error.email_subject is None or error.email_body_template is None:
            log.warning(
                "A precondition error was raised but the user was not notified. "
                "We probably should implement an email for this error.",
                subscription_id=str(subscription.id),
                subscription_benefit_id=str(subscription_benefit.id),
            )
            return

        email_renderer = get_email_renderer({"subscription": "polar.subscription"})
        email_sender = get_email_sender()

        await session.refresh(subscription, {"user", "subscription_tier"})

        subject, body = email_renderer.render_from_template(
            error.email_subject,
            f"subscription/{error.email_body_template}",
            {
                "subscription": subscription,
                "subscription_tier": subscription.subscription_tier,
                "subscription_benefit": subscription_benefit,
                "user": subscription.user,
                **error.email_extra_context,
            },
        )

        email_sender.send_to_user(subscription.user.email, subject, body)

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

    async def _get_granted_by_benefit(
        self,
        session: AsyncSession,
        subscription_benefit: SubscriptionBenefit,
    ) -> Sequence[SubscriptionBenefitGrant]:
        statement = select(SubscriptionBenefitGrant).where(
            SubscriptionBenefitGrant.subscription_benefit_id == subscription_benefit.id,
            SubscriptionBenefitGrant.is_granted.is_(True),
            SubscriptionBenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()


subscription_benefit_grant = SubscriptionBenefitGrantService(SubscriptionBenefitGrant)
