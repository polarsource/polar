import pytest_asyncio

from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Subscription,
    SubscriptionBenefit,
)
from polar.models.advertisement_campaign import AdvertisementCampaign


@pytest_asyncio.fixture
async def advertisement_campaign(
    session: AsyncSession,
    subscription: Subscription,
    subscription_benefit_organization: SubscriptionBenefit,
) -> AdvertisementCampaign:
    ad = AdvertisementCampaign(
        subscription_id=subscription.id,
        subscription_benefit_id=subscription_benefit_organization.id,
        image_url="",
        text="",
        link_url="",
    )
    session.add(ad)
    await session.commit()
    return ad
