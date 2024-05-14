import uuid

import pytest
from pytest_mock import MockerFixture

from polar.benefit.service.benefit import BenefitService
from polar.benefit.service.benefit import benefit as benefit_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Benefit, Organization
from polar.models.benefit import BenefitType
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    organization_post_install,
)
from polar.product.service.product import ProductService
from polar.product.service.product import (
    product as product_service,
)
from polar.worker import JobContext, PolarWorkerContext


@pytest.mark.asyncio
class TestOrganizationPostInstall:
    async def test_not_existing_organization(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_post_install(
                job_context, uuid.uuid4(), polar_worker_context
            )

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
        create_free_mock = mocker.patch.object(
            product_service,
            "create_free_tier",
            spec=ProductService.create_free_tier,
        )

        # then
        session.expunge_all()

        await organization_post_install(
            job_context, organization.id, polar_worker_context
        )

        get_or_create_articles_benefits_mock.assert_called_once()
        create_free_mock.assert_called_once()
