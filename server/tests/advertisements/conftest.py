import pytest_asyncio

from polar.models import Benefit, Organization
from polar.models.benefit import BenefitType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest_asyncio.fixture(autouse=True)
async def ads_benefit_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(
        save_fixture,
        organization=organization,
        type=BenefitType.ads,
        properties={"image_height": 100, "image_width": 100},
    )


@pytest_asyncio.fixture(autouse=True)
async def ads_benefit_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Benefit:
    return await create_benefit(
        save_fixture,
        organization=organization_second,
        type=BenefitType.ads,
        properties={"image_height": 100, "image_width": 100},
    )
