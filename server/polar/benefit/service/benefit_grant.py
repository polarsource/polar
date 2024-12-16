from collections.abc import Sequence
from typing import Any, Literal, TypeVar, Unpack, overload
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.benefit.benefits import BenefitPreconditionError, get_benefit_service
from polar.benefit.schemas import BenefitGrantWebhook
from polar.customer.service import customer as customer_service
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import Benefit, BenefitGrant, Customer, Product, ProductBenefit
from polar.models.benefit import BenefitProperties, BenefitType
from polar.models.benefit_grant import BenefitGrantPropertiesBase, BenefitGrantScope
from polar.models.webhook_endpoint import WebhookEventType
from polar.notifications.notification import (
    BenefitPreconditionErrorNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, sql
from polar.redis import Redis
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookPayloadTypeAdapter
from polar.worker import enqueue_job

from .benefit_grant_scope import resolve_scope, scope_to_args

log: Logger = structlog.get_logger()

BG = TypeVar("BG", bound=BenefitGrant)


class BenefitGrantError(PolarError): ...


class EmptyScopeError(BenefitGrantError):
    def __init__(self) -> None:
        message = "A scope must be provided to retrieve a benefit grant."
        super().__init__(message, 500)


class BenefitGrantService(ResourceServiceReader[BenefitGrant]):
    @overload
    async def get(
        self,
        session: AsyncSession,
        id: UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
        *,
        class_: None = None,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> BenefitGrant | None: ...

    @overload
    async def get(
        self,
        session: AsyncSession,
        id: UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
        *,
        class_: type[BG] | None = None,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> BG | None: ...

    async def get(
        self,
        session: AsyncSession,
        id: UUID,
        allow_deleted: bool = False,
        loaded: bool = False,
        *,
        class_: Any = None,
        options: Sequence[sql.ExecutableOption] | None = None,
    ) -> Any | None:
        if class_ is None:
            class_ = BenefitGrant

        query = select(class_).where(class_.id == id)
        if not allow_deleted:
            query = query.where(class_.deleted_at.is_(None))

        if loaded:
            query = query.options(
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization)
            )

        if options is not None:
            query = query.options(*options)

        res = await session.execute(query)
        return res.unique().scalar_one_or_none()

    async def list(
        self,
        session: AsyncSession,
        benefit: Benefit,
        *,
        is_granted: bool | None = None,
        customer_id: Sequence[UUID] | None = None,
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

        if customer_id is not None:
            statement = statement.where(BenefitGrant.customer_id.in_(customer_id))

        return await paginate(session, statement, pagination=pagination)

    async def grant_benefit(
        self,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        benefit: Benefit,
        *,
        attempt: int = 1,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant:
        log.info(
            "Granting benefit", benefit_id=str(benefit.id), customer_id=str(customer.id)
        )

        grant = await self.get_by_benefit_and_scope(session, customer, benefit, **scope)

        if grant is None:
            grant = BenefitGrant(
                customer=customer, benefit=benefit, properties={}, **scope
            )
            session.add(grant)
        elif grant.is_granted:
            return grant

        previous_properties = grant.properties
        benefit_service = get_benefit_service(benefit.type, session, redis)
        try:
            properties = await benefit_service.grant(
                benefit,
                customer,
                grant.properties,
                attempt=attempt,
            )
        except BenefitPreconditionError as e:
            await self.handle_precondition_error(session, e, customer, benefit, **scope)
            grant.granted_at = None
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)
        await session.commit()

        await eventstream_publish(
            "benefit.granted",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            customer_id=customer.id,
        )

        log.info(
            "Benefit granted",
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
            grant_id=str(grant.id),
        )

        await self._send_webhook(
            session,
            benefit,
            grant,
            event_type=WebhookEventType.benefit_grant_created,
            previous_grant_properties=previous_properties,
        )
        return grant

    async def revoke_benefit(
        self,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        benefit: Benefit,
        *,
        attempt: int = 1,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant:
        log.info(
            "Revoking benefit", benefit_id=str(benefit.id), customer_id=str(customer.id)
        )

        grant = await self.get_by_benefit_and_scope(session, customer, benefit, **scope)

        if grant is None:
            grant = BenefitGrant(
                customer=customer, benefit=benefit, properties={}, **scope
            )
            session.add(grant)
        elif grant.is_revoked:
            return grant

        previous_properties = grant.properties

        benefit_service = get_benefit_service(benefit.type, session, redis)
        # Call the revoke logic in two cases:
        # * If the service requires grants to be revoked individually
        # * If there is only one grant remaining for this benefit,
        #   so the benefit remains if other grants exist via other purchases
        other_grants = await self._get_granted_by_benefit_and_customer(
            session, benefit, customer
        )
        if benefit_service.should_revoke_individually or len(other_grants) < 2:
            properties = await benefit_service.revoke(
                benefit,
                customer,
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
            customer_id=customer.id,
        )

        log.info(
            "Benefit revoked",
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
            grant_id=str(grant.id),
        )

        await self._send_webhook(
            session,
            benefit,
            grant,
            event_type=WebhookEventType.benefit_grant_revoked,
            previous_grant_properties=previous_properties,
        )
        return grant

    async def enqueue_benefits_grants(
        self,
        session: AsyncSession,
        task: Literal["grant", "revoke"],
        customer: Customer,
        product: Product,
        **scope: Unpack[BenefitGrantScope],
    ) -> None:
        # Get granted benefits that are not part of this product.
        # It happens if the subscription has been upgraded/downgraded.
        outdated_grants = await self._get_outdated_grants(session, product, **scope)

        for benefit in product.benefits:
            enqueue_job(
                f"benefit.{task}",
                customer_id=customer.id,
                benefit_id=benefit.id,
                **scope_to_args(scope),
            )

        for outdated_grant in outdated_grants:
            enqueue_job(
                "benefit.revoke",
                customer_id=customer.id,
                benefit_id=outdated_grant.benefit_id,
                **scope_to_args(scope),
            )

    async def enqueue_benefit_grant_updates(
        self,
        session: AsyncSession,
        redis: Redis,
        benefit: Benefit,
        previous_properties: BenefitProperties,
    ) -> None:
        benefit_service = get_benefit_service(benefit.type, session, redis)
        if not await benefit_service.requires_update(benefit, previous_properties):
            return

        grants = await self._get_granted_by_benefit(session, benefit)
        for grant in grants:
            enqueue_job("benefit.update", benefit_grant_id=grant.id)

    async def update_benefit_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        grant: BenefitGrant,
        *,
        attempt: int = 1,
    ) -> BenefitGrant:
        # Don't update revoked benefits
        if grant.is_revoked:
            return grant

        benefit = grant.benefit

        customer = await customer_service.get(session, grant.customer_id)
        assert customer is not None

        previous_properties = grant.properties
        benefit_service = get_benefit_service(benefit.type, session, redis)
        try:
            properties = await benefit_service.grant(
                benefit,
                customer,
                grant.properties,
                update=True,
                attempt=attempt,
            )
        except BenefitPreconditionError as e:
            scope = await resolve_scope(session, grant.scope)
            await self.handle_precondition_error(session, e, customer, benefit, **scope)
            grant.granted_at = None
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)

        await self._send_webhook(
            session,
            benefit,
            grant,
            event_type=WebhookEventType.benefit_grant_updated,
            previous_grant_properties=previous_properties,
        )
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
        redis: Redis,
        grant: BenefitGrant,
        *,
        attempt: int = 1,
    ) -> BenefitGrant:
        # Already revoked, nothing to do
        if grant.is_revoked:
            return grant

        await session.refresh(grant, {"benefit"})
        benefit = grant.benefit

        customer = await customer_service.get(session, grant.customer_id)
        assert customer is not None

        previous_properties = grant.properties
        benefit_service = get_benefit_service(benefit.type, session, redis)
        properties = await benefit_service.revoke(
            benefit,
            customer,
            grant.properties,
            attempt=attempt,
        )

        grant.properties = properties
        grant.set_revoked()

        session.add(grant)
        await self._send_webhook(
            session,
            benefit,
            grant,
            event_type=WebhookEventType.benefit_grant_revoked,
            previous_grant_properties=previous_properties,
        )
        return grant

    async def handle_precondition_error(
        self,
        session: AsyncSession,
        error: BenefitPreconditionError,
        customer: Customer,
        benefit: Benefit,
        **scope: Unpack[BenefitGrantScope],
    ) -> None:
        if error.payload is None:
            log.warning(
                "A precondition error was raised but the customer was not notified. "
                "We probably should implement a notification for this error.",
                benefit_id=str(benefit.id),
                customer_id=str(customer.id),
                scope=scope,
            )
            return

        log.info(
            "Precondition error while granting benefit. Customer was informed.",
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
        )

        # Disable the notification for now as it's a bit noisy for some use-cases
        # We'll change how benefits are granted in the future so this won't be needed
        return

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
        customer: Customer,
        benefit_type: BenefitType,
    ) -> None:
        log.info(
            "Enqueueing benefit grants after precondition fulfilled",
            customer_id=str(customer.id),
            benefit_type=benefit_type,
        )

        grants = await self._get_by_customer_and_benefit_type(
            session, customer, benefit_type
        )
        for grant in grants:
            if not grant.is_granted and not grant.is_revoked:
                enqueue_job(
                    "benefit.grant",
                    customer_id=customer.id,
                    benefit_id=grant.benefit_id,
                    **grant.scope,
                )

    async def get_by_benefit_and_scope(
        self,
        session: AsyncSession,
        customer: Customer,
        benefit: Benefit,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant | None:
        statement = select(BenefitGrant).where(
            BenefitGrant.customer_id == customer.id,
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

    async def _get_granted_by_benefit_and_customer(
        self,
        session: AsyncSession,
        benefit: Benefit,
        customer: Customer,
    ) -> Sequence[BenefitGrant]:
        statement = select(BenefitGrant).where(
            BenefitGrant.benefit_id == benefit.id,
            BenefitGrant.customer_id == customer.id,
            BenefitGrant.is_granted.is_(True),
            BenefitGrant.deleted_at.is_(None),
        )

        result = await session.execute(statement)
        return result.scalars().all()

    async def _get_by_customer_and_benefit_type(
        self,
        session: AsyncSession,
        customer: Customer,
        benefit_type: BenefitType,
    ) -> Sequence[BenefitGrant]:
        statement = (
            select(BenefitGrant)
            .join(Benefit)
            .where(
                BenefitGrant.customer_id == customer.id,
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

    async def _send_webhook(
        self,
        session: AsyncSession,
        benefit: Benefit,
        grant: BenefitGrant,
        event_type: (
            Literal[WebhookEventType.benefit_grant_created]
            | Literal[WebhookEventType.benefit_grant_updated]
            | Literal[WebhookEventType.benefit_grant_revoked]
        ),
        previous_grant_properties: BenefitGrantPropertiesBase,
    ) -> None:
        loaded = await self.get(session, grant.id, loaded=True)
        data = BenefitGrantWebhook.model_validate(loaded)
        data.previous_properties = previous_grant_properties
        await webhook_service.send_payload(
            session,
            target=benefit.organization,
            payload=WebhookPayloadTypeAdapter.validate_python(
                dict(
                    type=event_type,
                    data=data,
                )
            ),
        )


benefit_grant = BenefitGrantService(BenefitGrant)
