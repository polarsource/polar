import uuid
from typing import Literal, Unpack

import structlog
from arq import Retry

from polar.customer.service import customer as customer_service
from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models.benefit_grant import BenefitGrantScopeArgs
from polar.product.service.product import product as product_service
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    get_worker_redis,
    task,
)

from .benefits import BenefitRetriableError
from .service.benefit import benefit as benefit_service
from .service.benefit_grant import benefit_grant as benefit_grant_service
from .service.benefit_grant_scope import resolve_scope

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


@task("benefit.enqueue_benefits_grants")
async def enqueue_benefits_grants(
    ctx: JobContext,
    task: Literal["grant", "revoke"],
    customer_id: uuid.UUID,
    product_id: uuid.UUID,
    polar_context: PolarWorkerContext,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        customer = await customer_service.get(session, customer_id)
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        product = await product_service.get(session, product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        resolved_scope = await resolve_scope(session, scope)

        await benefit_grant_service.enqueue_benefits_grants(
            session, task, customer, product, **resolved_scope
        )


@task("benefit.grant")
async def benefit_grant(
    ctx: JobContext,
    customer_id: uuid.UUID,
    benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        customer = await customer_service.get(session, customer_id)
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        benefit = await benefit_service.get(session, benefit_id, loaded=True)
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        resolved_scope = await resolve_scope(session, scope)

        try:
            await benefit_grant_service.grant_benefit(
                session,
                get_worker_redis(ctx),
                customer,
                benefit,
                attempt=ctx["job_try"],
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
            raise Retry(e.defer_seconds) from e


@task("benefit.revoke")
async def benefit_revoke(
    ctx: JobContext,
    customer_id: uuid.UUID,
    benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        customer = await customer_service.get(session, customer_id)
        if customer is None:
            raise CustomerDoesNotExist(customer_id)

        benefit = await benefit_service.get(session, benefit_id, loaded=True)
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        resolved_scope = await resolve_scope(session, scope)

        try:
            await benefit_grant_service.revoke_benefit(
                session,
                get_worker_redis(ctx),
                customer,
                benefit,
                attempt=ctx["job_try"],
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
            raise Retry(e.defer_seconds) from e


@task("benefit.update")
async def benefit_update(
    ctx: JobContext,
    benefit_grant_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        benefit_grant = await benefit_grant_service.get(
            session, benefit_grant_id, loaded=True
        )
        if benefit_grant is None:
            raise BenefitGrantDoesNotExist(benefit_grant_id)

        try:
            await benefit_grant_service.update_benefit_grant(
                session, get_worker_redis(ctx), benefit_grant, attempt=ctx["job_try"]
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while updating benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_grant_id=str(benefit_grant_id),
            )
            raise Retry(e.defer_seconds) from e


@task("benefit.delete")
async def benefit_delete(
    ctx: JobContext,
    benefit_grant_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        benefit_grant = await benefit_grant_service.get(session, benefit_grant_id)
        if benefit_grant is None:
            raise BenefitGrantDoesNotExist(benefit_grant_id)

        try:
            await benefit_grant_service.delete_benefit_grant(
                session, get_worker_redis(ctx), benefit_grant, attempt=ctx["job_try"]
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while deleting benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_grant_id=str(benefit_grant_id),
            )
            raise Retry(e.defer_seconds) from e
