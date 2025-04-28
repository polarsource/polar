import uuid

import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Organization
from polar.organization.tasks import OrganizationDoesNotExist, organization_created


@pytest.mark.asyncio
class TestOrganizationCreated:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_created(uuid.uuid4())

    async def test_existing_organization(
        self, organization: Organization, session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        await organization_created(organization.id)
