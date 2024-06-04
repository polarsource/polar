import pytest
import pytest_asyncio

from polar.advertisement.service import (
    advertisement_campaign as advertisement_campaign_service,
)
from polar.auth.models import AuthSubject
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.models import Benefit, Organization, User, UserOrganization
from polar.models.benefit import BenefitType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_advertisement_campaign,
    create_benefit,
    create_benefit_grant,
)


@pytest_asyncio.fixture(autouse=True)
async def ads_benefit_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(
        save_fixture, organization=organization, type=BenefitType.ads
    )


@pytest_asyncio.fixture(autouse=True)
async def ads_benefit_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Benefit:
    return await create_benefit(
        save_fixture, organization=organization_second, type=BenefitType.ads
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    async def test_valid(
        self,
        auth_subject: AuthSubject[User | Organization],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_second: User,
        user: User,
        user_organization: UserOrganization,
        ads_benefit_organization: Benefit,
        ads_benefit_organization_second: Benefit,
    ) -> None:
        campaign1 = await create_advertisement_campaign(save_fixture, user=user)
        await create_benefit_grant(
            save_fixture,
            user=user,
            benefit=ads_benefit_organization,
            granted=True,
            properties={"advertisement_campaign_id": str(campaign1.id)},
        )
        await create_benefit_grant(
            save_fixture,
            user=user,
            benefit=ads_benefit_organization,
            granted=True,
            properties={"advertisement_campaign_id": str(campaign1.id)},
        )

        campaign2 = await create_advertisement_campaign(save_fixture, user=user_second)
        await create_benefit_grant(
            save_fixture,
            user=user_second,
            benefit=ads_benefit_organization,
            granted=True,
            properties={"advertisement_campaign_id": str(campaign2.id)},
        )

        campaign3 = await create_advertisement_campaign(save_fixture, user=user)
        await create_benefit_grant(
            save_fixture,
            user=user,
            benefit=ads_benefit_organization_second,
            granted=True,
            properties={"advertisement_campaign_id": str(campaign3.id)},
        )

        advertisement_campaigns, count = await advertisement_campaign_service.list(
            session,
            benefit_id=ads_benefit_organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert count == 2
        assert len(advertisement_campaigns) == 2

        for _, benefit in advertisement_campaigns:
            assert benefit.id == ads_benefit_organization.id


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestTrackView:
    async def test_valid(
        self, save_fixture: SaveFixture, session: AsyncSession, user: User
    ) -> None:
        campaign = await create_advertisement_campaign(save_fixture, user=user)
        assert campaign.views == 0

        updated_campaign = await advertisement_campaign_service.track_view(
            session, campaign
        )
        assert updated_campaign.views == 1
