import uuid

import pytest
from pytest_mock import MockerFixture

from polar.models import Product
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionService
from polar.subscription.tasks import (  # type: ignore[attr-defined]
    SubscriptionTierDoesNotExist,
    subscription_service,
    subscription_update_product_benefits_grants,
)
from polar.worker import JobContext


@pytest.mark.asyncio
class TestSubscriptionUpdateProductBenefitsGrants:
    async def test_not_existing_subscription_tier(
        self, job_context: JobContext, session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionTierDoesNotExist):
            await subscription_update_product_benefits_grants(job_context, uuid.uuid4())

    async def test_existing_subscription_tier(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        product: Product,
        session: AsyncSession,
    ) -> None:
        update_product_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "update_product_benefits_grants",
            spec=SubscriptionService.update_product_benefits_grants,
        )

        # then
        session.expunge_all()

        await subscription_update_product_benefits_grants(job_context, product.id)

        update_product_benefits_grants_mock.assert_called_once()
