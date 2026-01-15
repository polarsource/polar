import uuid

import pytest
from pytest_mock import MockerFixture

from polar.models import Product
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionService
from polar.subscription.tasks import (
    SubscriptionTierDoesNotExist,
    subscription_service,
    subscription_update_product_benefits_grants,
)


@pytest.mark.asyncio
class TestSubscriptionUpdateProductBenefitsGrants:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionTierDoesNotExist):
            await subscription_update_product_benefits_grants(uuid.uuid4())

    async def test_existing_subscription_tier(
        self,
        mocker: MockerFixture,
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

        await subscription_update_product_benefits_grants(product.id)

        update_product_benefits_grants_mock.assert_called_once()
