import uuid

from polar.exceptions import PolarError
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


@task("organization.post_install")
async def organization_post_install(
    ctx: JobContext, organization_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
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

        await organization_service.set_personal_account(
            session, organization=organization
        )
