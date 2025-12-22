import builtins
from collections.abc import Sequence
from typing import Any, Literal, TypeVar, Unpack, overload
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.customer.repository import CustomerRepository
from polar.event.service import event as event_service
from polar.event.system import SystemEvent, build_system_event
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.logging import Logger
from polar.models import Benefit, BenefitGrant, Customer, Member, Product
from polar.models.benefit_grant import BenefitGrantScope
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession, sql
from polar.redis import Redis
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from ..registry import get_benefit_strategy
from ..strategies import (
    BenefitActionRequiredError,
    BenefitGrantProperties,
    BenefitProperties,
)
from .repository import BenefitGrantRepository
from .scope import scope_to_args
from .sorting import BenefitGrantSortProperty

log: Logger = structlog.get_logger()

BG = TypeVar("BG", bound=BenefitGrant)


class BenefitGrantError(PolarError): ...


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
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
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
        member_id: Sequence[UUID] | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[BenefitGrant], int]:
        statement = (
            select(BenefitGrant)
            .where(
                BenefitGrant.benefit_id == benefit.id,
                BenefitGrant.deleted_at.is_(None),
            )
            .order_by(BenefitGrant.created_at.desc())
            .options(
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit),
            )
        )

        if is_granted is not None:
            statement = statement.where(BenefitGrant.is_granted.is_(is_granted))

        if customer_id is not None:
            statement = statement.where(BenefitGrant.customer_id.in_(customer_id))

        if member_id is not None:
            statement = statement.where(BenefitGrant.member_id.in_(member_id))

        return await paginate(session, statement, pagination=pagination)

    async def list_by_organization(
        self,
        session: AsyncSession,
        organization_id: UUID,
        *,
        is_granted: bool | None = None,
        customer_id: Sequence[UUID] | None = None,
        pagination: PaginationParams,
        sorting: builtins.list[Sorting[BenefitGrantSortProperty]] = [
            (BenefitGrantSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[BenefitGrant], int]:
        repository = BenefitGrantRepository.from_session(session)
        statement = (
            select(BenefitGrant)
            .join(Benefit, BenefitGrant.benefit_id == Benefit.id)
            .where(
                Benefit.organization_id == organization_id,
                BenefitGrant.deleted_at.is_(None),
            )
            .options(
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
            )
        )

        if is_granted is not None:
            statement = statement.where(BenefitGrant.is_granted.is_(is_granted))

        if customer_id is not None:
            statement = statement.where(BenefitGrant.customer_id.in_(customer_id))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def grant_benefit(
        self,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
        benefit: Benefit,
        *,
        member: Member | None = None,
        attempt: int = 1,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant:
        log.info(
            "Granting benefit",
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
            member_id=str(member.id) if member else None,
        )

        repository = BenefitGrantRepository.from_session(session)
        grant = await repository.get_by_benefit_and_scope(
            customer, benefit, member=member, **scope
        )

        if grant is None:
            grant = BenefitGrant(
                customer=customer,
                benefit=benefit,
                member=member,
                properties={},
                **scope,
            )
            session.add(grant)
        elif grant.is_granted:
            return grant

        previous_properties = grant.properties
        benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
        try:
            properties = await benefit_strategy.grant(
                benefit,
                customer,
                grant.properties,
                attempt=attempt,
            )
        except BenefitActionRequiredError as e:
            grant.set_grant_failed(e)
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)
        await session.flush()

        await eventstream_publish(
            "benefit.granted",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            customer_id=customer.id,
        )

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.benefit_granted,
                customer=customer,
                organization=benefit.organization,
                metadata={
                    "benefit_id": str(benefit.id),
                    "benefit_grant_id": str(grant.id),
                    "benefit_type": benefit.type,
                },
            ),
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
        member: Member | None = None,
        attempt: int = 1,
        **scope: Unpack[BenefitGrantScope],
    ) -> BenefitGrant:
        log.info(
            "Revoking benefit",
            benefit_id=str(benefit.id),
            customer_id=str(customer.id),
            member_id=str(member.id) if member else None,
        )

        repository = BenefitGrantRepository.from_session(session)
        grant = await repository.get_by_benefit_and_scope(
            customer, benefit, member=member, **scope
        )

        if grant is None:
            grant = BenefitGrant(
                customer=customer,
                benefit=benefit,
                member=member,
                properties={},
                **scope,
            )
            session.add(grant)
        elif grant.is_revoked:
            return grant

        previous_properties = grant.properties

        benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
        # Call the revoke logic in two cases:
        # * If the service requires grants to be revoked individually
        # * If there is only one grant remaining for this benefit,
        #   so the benefit remains if other grants exist via other purchases
        other_grants = await repository.list_granted_by_benefit_and_customer(
            benefit, customer
        )
        if benefit_strategy.should_revoke_individually or len(other_grants) < 2:
            try:
                properties = await benefit_strategy.revoke(
                    benefit,
                    customer,
                    grant.properties,
                    attempt=attempt,
                )
                grant.properties = properties
            except BenefitActionRequiredError:
                pass

        grant.set_revoked()

        session.add(grant)
        await session.flush()

        await eventstream_publish(
            "benefit.revoked",
            {"benefit_id": benefit.id, "benefit_type": benefit.type},
            customer_id=customer.id,
        )

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.benefit_revoked,
                customer=customer,
                organization=benefit.organization,
                metadata={
                    "benefit_id": str(benefit.id),
                    "benefit_grant_id": str(grant.id),
                    "benefit_type": benefit.type,
                },
            ),
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
        member_id: UUID | None = None,
        **scope: Unpack[BenefitGrantScope],
    ) -> None:
        repository = BenefitGrantRepository.from_session(session)

        # Get existing grants for this customer and scope to avoid redundant jobs
        existing_grants = await repository.list_by_customer_and_scope(customer, **scope)
        granted_benefit_ids = {g.benefit_id for g in existing_grants if g.is_granted}
        # Don't retry grants that failed due to required customer action -
        # they should only be retried when the customer takes that action
        errored_benefit_ids = {
            g.benefit_id
            for g in existing_grants
            if g.error and g.error.get("type") == BenefitActionRequiredError.__name__
        }

        if task == "grant":
            benefits_to_process = [
                b
                for b in product.benefits
                if b.id not in granted_benefit_ids and b.id not in errored_benefit_ids
            ]
        else:
            # Only revoke benefits that are actually granted
            benefits_to_process = [
                b for b in product.benefits if b.id in granted_benefit_ids
            ]

        for benefit in benefits_to_process:
            enqueue_job(
                f"benefit.{task}",
                customer_id=customer.id,
                benefit_id=benefit.id,
                member_id=member_id,
                **scope_to_args(scope),
            )

        # Get granted benefits that are not part of this product.
        # It happens if the subscription has been upgraded/downgraded.
        outdated_grants = await repository.list_outdated_grants(product, **scope)
        for outdated_grant in outdated_grants:
            enqueue_job(
                "benefit.revoke",
                customer_id=customer.id,
                benefit_id=outdated_grant.benefit_id,
                member_id=member_id,
                **scope_to_args(scope),
            )

    async def enqueue_benefit_grant_updates(
        self,
        session: AsyncSession,
        redis: Redis,
        benefit: Benefit,
        previous_properties: BenefitProperties,
    ) -> None:
        benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
        if not await benefit_strategy.requires_update(benefit, previous_properties):
            return

        repository = BenefitGrantRepository.from_session(session)
        grants = await repository.list_granted_by_benefit(benefit)
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

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(grant.customer_id)
        # Deleted customer, don't update the grant
        if customer is None:
            return grant

        previous_properties = grant.properties
        benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
        try:
            properties = await benefit_strategy.grant(
                benefit,
                customer,
                grant.properties,
                update=True,
                attempt=attempt,
            )
        except BenefitActionRequiredError as e:
            grant.set_grant_failed(e)
        else:
            grant.properties = properties
            grant.set_granted()

        session.add(grant)

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.benefit_updated,
                customer=customer,
                organization=benefit.organization,
                metadata={
                    "benefit_id": str(benefit.id),
                    "benefit_grant_id": str(grant.id),
                    "benefit_type": benefit.type,
                },
            ),
        )

        await self._send_webhook(
            session,
            benefit,
            grant,
            event_type=WebhookEventType.benefit_grant_updated,
            previous_grant_properties=previous_properties,
        )
        return grant

    async def enqueue_benefit_grant_cycles(
        self,
        session: AsyncSession,
        redis: Redis,
        **scope: Unpack[BenefitGrantScope],
    ) -> None:
        repository = BenefitGrantRepository.from_session(session)
        grants = await repository.list_granted_by_scope(**scope)
        for grant in grants:
            enqueue_job("benefit.cycle", benefit_grant_id=grant.id)

    async def cycle_benefit_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        grant: BenefitGrant,
        *,
        attempt: int = 1,
    ) -> BenefitGrant:
        # Don't cycle revoked benefits
        if grant.is_revoked:
            return grant

        benefit = grant.benefit

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(grant.customer_id)
        assert customer is not None

        previous_properties = grant.properties
        benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
        try:
            properties = await benefit_strategy.cycle(
                benefit,
                customer,
                grant.properties,
                attempt=attempt,
            )
        except BenefitActionRequiredError as e:
            grant.set_grant_failed(e)
        else:
            grant.properties = properties

        grant.set_modified_at()
        session.add(grant)

        await event_service.create_event(
            session,
            build_system_event(
                SystemEvent.benefit_cycled,
                customer=customer,
                organization=benefit.organization,
                metadata={
                    "benefit_id": str(benefit.id),
                    "benefit_grant_id": str(grant.id),
                    "benefit_type": benefit.type,
                },
            ),
        )

        await self._send_webhook(
            session,
            benefit,
            grant,
            event_type=WebhookEventType.benefit_grant_cycled,
            previous_grant_properties=previous_properties,
        )
        return grant

    async def enqueue_benefit_grant_deletions(
        self, session: AsyncSession, benefit: Benefit
    ) -> None:
        repository = BenefitGrantRepository.from_session(session)
        grants = await repository.list_granted_by_benefit(benefit)
        for grant in grants:
            enqueue_job("benefit.delete_grant", benefit_grant_id=grant.id)

    async def enqueue_customer_grant_deletions(
        self, session: AsyncSession, customer: Customer
    ) -> None:
        repository = BenefitGrantRepository.from_session(session)
        grants = await repository.list_granted_by_customer(customer.id)
        for grant in grants:
            enqueue_job("benefit.delete_grant", benefit_grant_id=grant.id)

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

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            grant.customer_id, include_deleted=True
        )
        assert customer is not None

        previous_properties = grant.properties
        benefit_strategy = get_benefit_strategy(benefit.type, session, redis)
        properties = await benefit_strategy.revoke(
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

    async def _send_webhook(
        self,
        session: AsyncSession,
        benefit: Benefit,
        grant: BenefitGrant,
        event_type: Literal[
            WebhookEventType.benefit_grant_created,
            WebhookEventType.benefit_grant_updated,
            WebhookEventType.benefit_grant_cycled,
            WebhookEventType.benefit_grant_revoked,
        ],
        previous_grant_properties: BenefitGrantProperties,
    ) -> None:
        loaded = await self.get(session, grant.id, loaded=True)
        assert loaded is not None
        loaded.previous_properties = previous_grant_properties
        await webhook_service.send(session, benefit.organization, event_type, loaded)
        enqueue_job(
            "customer.webhook",
            WebhookEventType.customer_state_changed,
            grant.customer_id,
        )


benefit_grant = BenefitGrantService(BenefitGrant)
