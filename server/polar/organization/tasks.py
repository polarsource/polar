import uuid

from polar.exceptions import PolarError
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

        await subscription_tier_service.create_free(session, organization=organization)
