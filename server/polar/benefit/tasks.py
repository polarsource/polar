import uuid
from typing import Literal, Unpack

import structlog
from dramatiq import Retry

from polar.benefit.repository import BenefitRepository
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models.benefit_grant import BenefitGrantScopeArgs
from polar.product.repository import ProductRepository
from polar.worker import (
    AsyncSessionMaker,
    RedisMiddleware,
    TaskPriority,
    actor,
    get_retries,
)

from .grant.scope import resolve_member, resolve_scope
from .grant.service import benefit_grant as benefit_grant_service
from .strategies import BenefitRetriableError

log: Logger = structlog.get_logger()


class BenefitTaskError(PolarTaskError): ...


class CustomerDoesNotExist(BenefitTaskError):
    def __init__(self, customer_id: uuid.UUID) -> None:
        self.customer_id = customer_id
        message = f"The customer with id {customer_id} does not exist."
        super().__init__(message)


class ProductDoesNotExist(BenefitTaskError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.user_id = product_id
        message = f"The product with id {product_id} does not exist."
        super().__init__(message)


class BenefitDoesNotExist(BenefitTaskError):
    def __init__(self, benefit_id: uuid.UUID) -> None:
        self.benefit_id = benefit_id
        message = f"The benefit with id {benefit_id} does not exist."
        super().__init__(message)


class BenefitGrantDoesNotExist(BenefitTaskError):
    def __init__(self, benefit_grant_id: uuid.UUID) -> None:
        self.benefit_grant_id = benefit_grant_id
        message = f"The benefit grant with id {benefit_grant_id} does not exist."
        super().__init__(message)


class OrganizationDoesNotExist(BenefitTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


@actor(actor_name="benefit.enqueue_benefits_grants", priority=TaskPriority.MEDIUM)
async def enqueue_benefits_grants(
    task: Literal["grant", "revoke"],
    customer_id: uuid.UUID,
    product_id: uuid.UUID,
    member_id: uuid.UUID | None = None,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker() as session:
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            customer_id,
            # Allow deleted customers to be processed for revocation tasks
            include_deleted=task == "revoke",
        )
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        resolved_scope = await resolve_scope(session, scope)

        await benefit_grant_service.enqueue_benefits_grants(
            session, task, customer, product, member_id=member_id, **resolved_scope
        )


@actor(actor_name="benefit.grant", priority=TaskPriority.MEDIUM)
async def benefit_grant(
    customer_id: uuid.UUID,
    benefit_id: uuid.UUID,
    member_id: uuid.UUID | None = None,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker() as session:
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(customer_id)
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        benefit_repository = BenefitRepository.from_session(session)
        benefit = await benefit_repository.get_by_id(
            benefit_id, options=benefit_repository.get_eager_options()
        )
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        resolved_scope = await resolve_scope(session, scope)

        product = None
        if subscription := resolved_scope.get("subscription"):
            product = subscription.product
        elif order := resolved_scope.get("order"):
            product = order.product
        is_seat_based = product.has_seat_based_price if product else False

        member = await resolve_member(
            session,
            customer_id=customer_id,
            organization=benefit.organization,
            member_id=member_id,
            is_seat_based=is_seat_based,
        )

        try:
            await benefit_grant_service.grant_benefit(
                session,
                RedisMiddleware.get(),
                customer,
                benefit,
                member=member,
                attempt=get_retries(),
                **resolved_scope,
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while granting benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_id=str(benefit_id),
                customer_id=str(customer_id),
            )
            raise Retry(delay=e.defer_milliseconds) from e


@actor(actor_name="benefit.revoke", priority=TaskPriority.MEDIUM)
async def benefit_revoke(
    customer_id: uuid.UUID,
    benefit_id: uuid.UUID,
    member_id: uuid.UUID | None = None,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker() as session:
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            customer_id,
            # Allow deleted customers to be processed for revocation tasks
            include_deleted=True,
        )
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        benefit_repository = BenefitRepository.from_session(session)
        benefit = await benefit_repository.get_by_id(
            benefit_id, options=benefit_repository.get_eager_options()
        )
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        resolved_scope = await resolve_scope(session, scope)

        product = None
        if subscription := resolved_scope.get("subscription"):
            product = subscription.product
        elif order := resolved_scope.get("order"):
            product = order.product
        is_seat_based = product.has_seat_based_price if product else False

        member = await resolve_member(
            session,
            customer_id=customer_id,
            organization=benefit.organization,
            member_id=member_id,
            is_seat_based=is_seat_based,
        )

        try:
            await benefit_grant_service.revoke_benefit(
                session,
                RedisMiddleware.get(),
                customer,
                benefit,
                member=member,
                attempt=get_retries(),
                **resolved_scope,
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while revoking benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_id=str(benefit_id),
                customer_id=str(customer_id),
            )
            raise Retry(delay=e.defer_milliseconds) from e


@actor(actor_name="benefit.update", priority=TaskPriority.MEDIUM)
async def benefit_update(benefit_grant_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        benefit_grant = await benefit_grant_service.get(
            session, benefit_grant_id, loaded=True
        )
        if benefit_grant is None:
            raise BenefitGrantDoesNotExist(benefit_grant_id)

        try:
            await benefit_grant_service.update_benefit_grant(
                session, RedisMiddleware.get(), benefit_grant, attempt=get_retries()
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while updating benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_grant_id=str(benefit_grant_id),
            )
            raise Retry(delay=e.defer_milliseconds) from e


@actor(actor_name="benefit.enqueue_benefit_grant_cycles", priority=TaskPriority.MEDIUM)
async def enqueue_benefit_grant_cycles(**scope: Unpack[BenefitGrantScopeArgs]) -> None:
    async with AsyncSessionMaker() as session:
        resolved_scope = await resolve_scope(session, scope)
        await benefit_grant_service.enqueue_benefit_grant_cycles(
            session, RedisMiddleware.get(), **resolved_scope
        )


@actor(actor_name="benefit.cycle", priority=TaskPriority.MEDIUM)
async def benefit_cycle(benefit_grant_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        benefit_grant = await benefit_grant_service.get(
            session, benefit_grant_id, loaded=True
        )
        if benefit_grant is None:
            raise BenefitGrantDoesNotExist(benefit_grant_id)

        try:
            await benefit_grant_service.cycle_benefit_grant(
                session, RedisMiddleware.get(), benefit_grant, attempt=get_retries()
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while cycling benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_grant_id=str(benefit_grant_id),
            )
            raise Retry(delay=e.defer_milliseconds) from e


@actor(actor_name="benefit.delete", priority=TaskPriority.MEDIUM)
async def benefit_delete(benefit_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        benefit_repository = BenefitRepository.from_session(session)
        benefit = await benefit_repository.get_by_id(
            benefit_id,
            options=benefit_repository.get_eager_options(),
            include_deleted=True,
        )
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        await benefit_grant_service.enqueue_benefit_grant_deletions(session, benefit)


@actor(actor_name="benefit.revoke_customer", priority=TaskPriority.MEDIUM)
async def benefit_revoke_customer(customer_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            customer_id, include_deleted=True
        )
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        await benefit_grant_service.enqueue_customer_grant_deletions(session, customer)


@actor(actor_name="benefit.delete_grant", priority=TaskPriority.MEDIUM)
async def benefit_delete_grant(benefit_grant_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        benefit_grant = await benefit_grant_service.get(
            session, benefit_grant_id, loaded=True
        )
        if benefit_grant is None:
            raise BenefitGrantDoesNotExist(benefit_grant_id)

        try:
            await benefit_grant_service.delete_benefit_grant(
                session, RedisMiddleware.get(), benefit_grant, attempt=get_retries()
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while deleting benefit grant",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_grant_id=str(benefit_grant_id),
            )
            raise Retry(delay=e.defer_milliseconds) from e
