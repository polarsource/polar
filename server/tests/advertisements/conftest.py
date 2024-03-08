import pytest_asyncio

from polar.models import (
    Subscription,
    SubscriptionBenefit,
)
from polar.models.advertisement_campaign import AdvertisementCampaign
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def advertisement_campaign(
    save_fixture: SaveFixture,
    subscription: Subscription,
    subscription_benefit_organization: SubscriptionBenefit,
) -> AdvertisementCampaign:
    ad = AdvertisementCampaign(
        subscription_id=subscription.id,
        subscription_benefit_id=subscription_benefit_organization.id,
        image_url="https://example.com/img.jpg",
        text="",
        link_url="https://example.com",
    )
    await save_fixture(ad)
    return ad
