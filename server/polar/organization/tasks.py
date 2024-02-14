import uuid

from polar.account.service import account as account_service
from polar.exceptions import PolarError
from polar.held_transfer.service import held_transfer as held_transfer_service
from polar.postgres import AsyncSession
from polar.subscription.service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from polar.subscription.service.subscription_tier import (
    subscription_tier as subscription_tier_service,
)
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import organization as organization_service


class OrganizationTaskError(PolarError):
    ...


class OrganizationDoesNotExist(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message, 500)


class OrganizationAccountNotSet(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = (
            f"The organization with id {organization_id} "
            "does not have an account set."
        )
        super().__init__(message, 500)


class AccountDoesNotExist(OrganizationTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message, 500)


async def organization_post_creation_actions(
    session: AsyncSession,
    organization_id: uuid.UUID,
) -> None:
    organization = await organization_service.get(session, organization_id)
    if organization is None:
        raise OrganizationDoesNotExist(organization_id)

    (
        public_articles,
        _,
    ) = await subscription_benefit_service.get_or_create_articles_benefits(
        session, organization=organization
    )
    await subscription_tier_service.create_free(
        session, benefits=[public_articles], organization=organization
    )

    await organization_service.set_personal_account(session, organization=organization)


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

        if account.can_receive_transfers():
            await held_transfer_service.release_account(session, account)


@task("organization.post_install")
async def organization_post_install(
    ctx: JobContext, organization_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await organization_post_creation_actions(session, organization_id)


@task("organization.post_user_upgrade")
async def organization_post_user_upgrade(
    ctx: JobContext, organization_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    """
    Triggered from initial user -> maintainer upgrade, i.e basic
    creation of personal organization from GitHub account.

    Same implementation as organization.post_install (GitHub App installation).
    However, we separate them into standalone tasks to keep things clear in
    terms of intent and initial invocation - avoiding problems in the future
    if they need to diverge.
    """

    async with AsyncSessionMaker(ctx) as session:
        await organization_post_creation_actions(session, organization_id)
