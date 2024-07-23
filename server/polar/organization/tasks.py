import uuid
from typing import cast

from polar.account.service import account as account_service
from polar.benefit.service.benefit import benefit as benefit_service
from polar.exceptions import PolarTaskError
from polar.held_balance.service import held_balance as held_balance_service
from polar.locker import Locker
from polar.product.service.product import (
    product as product_service,
)
from polar.redis import Redis
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import organization as organization_service


class OrganizationTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


class OrganizationAccountNotSet(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = (
            f"The organization with id {organization_id} "
            "does not have an account set."
        )
        super().__init__(message)


class AccountDoesNotExist(OrganizationTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message)


@task("organization.created")
async def organization_created(
    ctx: JobContext, organization_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    redis = cast(Redis, ctx["redis"])
    async with AsyncSessionMaker(ctx) as session:
        # We experienced in prod `organization.created` triggered twice
        # Adding a lock here to prevent a race condition
        async with Locker(redis).lock(
            f"organization.created:{organization_id}",
            timeout=10,
            blocking_timeout=10,
        ):
            organization = await organization_service.get(session, organization_id)
            if organization is None:
                raise OrganizationDoesNotExist(organization_id)

            (
                public_articles,
                _,
            ) = await benefit_service.get_or_create_articles_benefits(
                session, organization=organization
            )

            await product_service.create_free_tier(
                session, benefits=[public_articles], organization=organization
            )


@task("organization.account_set")
async def organization_account_set(
    ctx: JobContext, organization_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        organization = await organization_service.get(session, organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        if organization.account_id is None:
            raise OrganizationAccountNotSet(organization_id)

        account = await account_service.get_by_id(session, organization.account_id)
        if account is None:
            raise AccountDoesNotExist(organization.account_id)

        await held_balance_service.release_account(session, account)
