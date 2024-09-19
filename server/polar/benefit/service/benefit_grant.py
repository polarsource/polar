from collections.abc import Sequence
from typing import Literal, Unpack
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.benefit.benefits import BenefitPreconditionError, get_benefit_service
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import (
    Benefit,
    BenefitGrant,
    OAuthAccount,
    Product,
    ProductBenefit,
    User,
)
from polar.models.benefit import BenefitProperties, BenefitType
from polar.models.benefit_grant import BenefitGrantScope
from polar.models.user import OAuthPlatform
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    BenefitPreconditionErrorNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.user.service.user import user as user_service
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .benefit_grant_scope import resolve_scope, scope_to_args

log: Logger = structlog.get_logger()


class BenefitGrantError(PolarError): ...


class EmptyScopeError(BenefitGrantError):
    def __init__(self) -> None:
        message = "A scope must be provided to retrieve a benefit grant."
        super().__init__(message, 500)


class BenefitGrantService(ResourceServiceReader[BenefitGrant]):
    async def list(
        self,
        session: AsyncSession,
        benefit: Benefit,
        *,
        is_granted: bool | None = None,
        user_id: UUID | None = None,
        github_user_id: int | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[BenefitGrant], int]:
        statement = (
            select(BenefitGrant)
            .where(
                BenefitGrant.benefit_id == benefit.id,
                BenefitGrant.deleted_at.is_(None),
            )
            .order_by(BenefitGrant.created_at.desc())
        )

        if is_granted is not None:
            statement = statement.where(BenefitGrant.is_granted.is_(is_granted))

        if user_id is not None:
            statement = statement.where(BenefitGrant.user_id == user_id)

        if github_user_id is not None:
            oauth_account_statement = select(OAuthAccount.user_id).where(
                OAuthAccount.deleted_at.is_(None),
                OAuthAccount.platform == OAuthPlatform.github,
                OAuthAccount.account_id == str(github_user_id),
            )
            statement = statement.where(
                BenefitGrant.user_id.in_(oauth_account_statement)
            )

        return await paginate(session, statement, pagination=pagination)

    async def grant_benefit(
        self,
        session: AsyncSession,
        user: User,
        benefit: Benefit,
        *,
        attempt: int = 1,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant:
        log.info("Granting benefit", benefit_id=str(benefit.id), user_id=str(user.id))

        grant = await self.get_by_benefit_and_scope(session, user, benefit, **scope)

        if grant is None:
            grant = BenefitGrant(user=user, benefit=benefit, properties={}, **scope)
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
            await self.handle_precondition_error(session, e, user, benefit, **scope)
            grant.granted_at = None
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)
        await session.commit()

        await eventstream_publish(
            "benefit.granted",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            user_id=user.id,
        )

        log.info(
            "Benefit granted",
            benefit_id=str(benefit.id),
            user_id=str(user.id),
            grant_id=str(grant.id),
        )

        await webhook_service.send(
            session,
            target=benefit.organization,
            we=(WebhookEventType.benefit_granted, grant),
        )
        return grant

    async def revoke_benefit(
        self,
        session: AsyncSession,
        user: User,
        benefit: Benefit,
        *,
        attempt: int = 1,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant:
        log.info("Revoking benefit", benefit_id=str(benefit.id), user_id=str(user.id))

        grant = await self.get_by_benefit_and_scope(session, user, benefit, **scope)

        if grant is None:
            grant = BenefitGrant(user=user, benefit=benefit, properties={}, **scope)
            session.add(grant)
        elif grant.is_revoked:
            return grant

        # Check if the user has other grants (from other purchases) for this benefit
        # If yes, don't call the revoke logic, just mark the grant as revoked
        other_grants = await self._get_granted_by_benefit_and_user(
            session, benefit, user
        )
        if len(other_grants) < 2:
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
            "benefit.revoked",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            user_id=user.id,
        )

        log.info(
            "Benefit revoked",
            benefit_id=str(benefit.id),
            user_id=str(user.id),
            grant_id=str(grant.id),
        )

        await webhook_service.send(
            session,
            target=benefit.organization,
            we=(WebhookEventType.benefit_revoked, grant),
        )
        return grant

    async def enqueue_benefits_grants(
        self,
        session: AsyncSession,
        task: Literal["grant", "revoke"],
        user: User,
        product: Product,
        **scope: Unpack[BenefitGrantScope],
    ) -> None:
        # Get granted benefits that are not part of this product.
        # It happens if the subscription has been upgraded/downgraded.
        outdated_grants = await self._get_outdated_grants(session, product, **scope)

        for benefit in product.benefits:
            enqueue_job(
                f"benefit.{task}",
                user_id=user.id,
                benefit_id=benefit.id,
                **scope_to_args(scope),
            )

        for outdated_grant in outdated_grants:
            enqueue_job(
                "benefit.revoke",
                user_id=user.id,
                benefit_id=outdated_grant.benefit_id,
                **scope_to_args(scope),
            )

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
            enqueue_job("benefit.update", benefit_grant_id=grant.id)

    async def update_benefit_grant(
        self,
        session: AsyncSession,
        grant: BenefitGrant,
        *,
        attempt: int = 1,
    ) -> BenefitGrant:
        # Don't update revoked benefits
        if grant.is_revoked:
            return grant

        await session.refresh(grant, {"benefit"})
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
            scope = await resolve_scope(session, grant.scope)
            await self.handle_precondition_error(session, e, user, benefit, **scope)
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
            enqueue_job("benefit.delete", benefit_grant_id=grant.id)

    async def delete_benefit_grant(
        self,
        session: AsyncSession,
        grant: BenefitGrant,
        *,
        attempt: int = 1,
    ) -> BenefitGrant:
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
        user: User,
        benefit: Benefit,
        **scope: Unpack[BenefitGrantScope],
    ) -> None:
        if error.payload is None:
            log.warning(
                "A precondition error was raised but the user was not notified. "
                "We probably should implement a notification for this error.",
                benefit_id=str(benefit.id),
                user_id=str(user.id),
                scope=scope,
            )
            return

        log.info(
            "Precondition error while granting benefit. User was informed.",
            benefit_id=str(benefit.id),
            user_id=str(user.id),
        )

        scope_name = ""
        organization_name = ""
        if subscription := scope.get("subscription"):
            await session.refresh(subscription, {"product"})
            scope_name = subscription.product.name
            subscription_tier = subscription.product
            managing_organization = await organization_service.get(
                session, subscription_tier.organization_id
            )
            assert managing_organization is not None
            organization_name = managing_organization.slug

        notification_payload = BenefitPreconditionErrorNotificationPayload(
            scope_name=scope_name,
            benefit_id=benefit.id,
            benefit_description=benefit.description,
            organization_name=organization_name,
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
            "Enqueueing benefit grants after precondition fulfilled",
            user_id=str(user.id),
            benefit_type=benefit_type,
        )

        grants = await self._get_by_user_and_benefit_type(session, user, benefit_type)
        for grant in grants:
            if not grant.is_granted and not grant.is_revoked:
                enqueue_job(
                    "benefit.grant",
                    user_id=user.id,
                    benefit_id=grant.benefit_id,
                    **grant.scope,
                )

    async def get_by_benefit_and_scope(
        self,
        session: AsyncSession,
        user: User,
        benefit: Benefit,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant | None:
        statement = select(BenefitGrant).where(
            BenefitGrant.user_id == user.id,
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.deleted_at.is_(None),
            BenefitGrant.scope == scope,
        )

        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def _get_granted_by_benefit(
        self, session: AsyncSession, benefit: Benefit
    ) -> Sequence[BenefitGrant]:
        statement = select(BenefitGrant).where(
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_granted_by_benefit_and_user(
        self,
        session: AsyncSession,
        benefit: Benefit,
        user: User,
    ) -> Sequence[BenefitGrant]:
        statement = select(BenefitGrant).where(
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.user_id == user.id,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_by_user_and_benefit_type(
        self,
        session: AsyncSession,
        user: User,
        benefit_type: BenefitType,
    ) -> Sequence[BenefitGrant]:
        statement = (
            select(BenefitGrant)
            .join(Benefit)
            .where(
                BenefitGrant.user_id == user.id,
                Benefit.type == benefit_type,
            )
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_outdated_grants(
        self,
        session: AsyncSession,
        product: Product,
        **scope: Unpack[BenefitGrantScope],
    ) -> Sequence[BenefitGrant]:
        product_benefits_statement = (
            select(Benefit.id)
            .join(ProductBenefit)
            .where(ProductBenefit.product_id == product.id)
        )

        statement = select(BenefitGrant).where(
            BenefitGrant.scope == scope,
            BenefitGrant.benefit_id.not_in(product_benefits_statement),
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()


benefit_grant = BenefitGrantService(BenefitGrant)
