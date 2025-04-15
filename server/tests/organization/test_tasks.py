import uuid

import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.organization.tasks import OrganizationDoesNotExist, organization_created
from polar.worker import JobContext


@pytest.mark.asyncio
class TestOrganizationCreated:
    async def test_not_existing_organization(
        self, job_context: JobContext, session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_created(job_context, uuid.uuid4())

    async def test_existing_organization(
        self, job_context: JobContext, organization: Organization, session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        await organization_created(job_context, organization.id)
