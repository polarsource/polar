import uuid

import pytest
from pytest_mock import MockerFixture

from polar.benefit.service.benefit import BenefitService
from polar.benefit.service.benefit import benefit as benefit_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Benefit, Organization
from polar.models.benefit import BenefitType
from polar.organization.tasks import OrganizationDoesNotExist, organization_created
from polar.worker import JobContext, PolarWorkerContext


@pytest.mark.asyncio
class TestOrganizationCreated:
    async def test_not_existing_organization(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_created(job_context, uuid.uuid4(), polar_worker_context)

    async def test_existing_organization(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        benefit = Benefit(
            type=BenefitType.articles,
            description="Public posts",
            is_tax_applicable=False,
            properties={"paid_articles": False},
            organization=organization,
        )
        get_or_create_articles_benefits_mock = mocker.patch.object(
            benefit_service,
            "get_or_create_articles_benefits",
            spec=BenefitService.get_or_create_articles_benefits,
        )
        get_or_create_articles_benefits_mock.return_value = (benefit, benefit)
        # then
        session.expunge_all()

        await organization_created(job_context, organization.id, polar_worker_context)

        get_or_create_articles_benefits_mock.assert_called_once()
