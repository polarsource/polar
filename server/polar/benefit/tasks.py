import uuid
from typing import Literal, Unpack

import structlog
from arq import Retry

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import BenefitGrantScopeArgs
from polar.product.service.product import product as product_service
from polar.user.service.user import user as user_service
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    task,
)

from .benefits import BenefitRetriableError
from .service.benefit import benefit as benefit_service
from .service.benefit_grant import benefit_grant as benefit_grant_service
from .service.benefit_grant_scope import resolve_scope

log: Logger = structlog.get_logger()


class BenefitTaskError(PolarTaskError): ...


class UserDoesNotExist(BenefitTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
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
    user_id: uuid.UUID,
    product_id: uuid.UUID,
    polar_context: PolarWorkerContext,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        product = await product_service.get(session, product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        resolved_scope = await resolve_scope(session, scope)

        await benefit_grant_service.enqueue_benefits_grants(
            session, task, user, product, **resolved_scope
        )


@task("benefit.grant")
async def benefit_grant(
    ctx: JobContext,
    user_id: uuid.UUID,
    benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        benefit = await benefit_service.get(session, benefit_id, loaded=True)
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        resolved_scope = await resolve_scope(session, scope)

        try:
            await benefit_grant_service.grant_benefit(
                session, user, benefit, attempt=ctx["job_try"], **resolved_scope
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while granting benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_id=str(benefit_id),
                user_id=str(user_id),
            )
            raise Retry(e.defer_seconds) from e


@task("benefit.revoke")
async def benefit_revoke(
    ctx: JobContext,
    user_id: uuid.UUID,
    benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
    **scope: Unpack[BenefitGrantScopeArgs],
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        benefit = await benefit_service.get(session, benefit_id, loaded=True)
        if benefit is None:
            raise BenefitDoesNotExist(benefit_id)

        resolved_scope = await resolve_scope(session, scope)

        try:
            await benefit_grant_service.revoke_benefit(
                session, user, benefit, attempt=ctx["job_try"], **resolved_scope
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while revoking benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_id=str(benefit_id),
                user_id=str(user_id),
            )
            raise Retry(e.defer_seconds) from e


@task("benefit.update")
async def benefit_update(
    ctx: JobContext,
    benefit_grant_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        benefit_grant = await benefit_grant_service.get(session, benefit_grant_id)
        if benefit_grant is None:
            raise BenefitGrantDoesNotExist(benefit_grant_id)

        try:
            await benefit_grant_service.update_benefit_grant(
                session, benefit_grant, attempt=ctx["job_try"]
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
                session, benefit_grant, attempt=ctx["job_try"]
            )
        except BenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while deleting benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                benefit_grant_id=str(benefit_grant_id),
            )
            raise Retry(e.defer_seconds) from e


@task("benefit.precondition_fulfilled")
async def benefit_precondition_fulfilled(
    ctx: JobContext,
    user_id: uuid.UUID,
    benefit_type: BenefitType,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        await benefit_grant_service.enqueue_grants_after_precondition_fulfilled(
            session, user, benefit_type
        )
