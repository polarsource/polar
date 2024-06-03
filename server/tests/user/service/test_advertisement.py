import pytest
from pydantic_core import Url

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Organization, User
from polar.models.benefit import BenefitType
from polar.user.schemas.advertisement import (
    UserAdvertisementCampaignCreate,
    UserAdvertisementCampaignEnable,
    UserAdvertisementCampaignUpdate,
)
from polar.user.service.advertisement import SortProperty
from polar.user.service.advertisement import (
    user_advertisement as user_advertisement_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_advertisement_campaign,
    create_benefit,
    create_benefit_grant,
)


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth
    async def test_other_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_second: User,
    ) -> None:
        await create_advertisement_campaign(save_fixture, user=user_second)

        advertisement_campaigns, count = await user_advertisement_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(advertisement_campaigns) == 0

    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_advertisement_campaign(save_fixture, user=user)

        advertisement_campaigns, count = await user_advertisement_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(advertisement_campaigns) == 1

    @pytest.mark.parametrize(
        "sorting",
        [
            [("created_at", True)],
            [("views", True)],
            [("clicks", False)],
        ],
    )
    @pytest.mark.auth
    async def test_sorting(
        self,
        sorting: list[Sorting[SortProperty]],
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        await create_advertisement_campaign(save_fixture, user=user)

        advertisement_campaigns, count = await user_advertisement_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(advertisement_campaigns) == 1


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetById:
    @pytest.mark.auth
    async def test_other_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user_second: User,
    ) -> None:
        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user_second
        )

        result = await user_advertisement_service.get_by_id(
            session, auth_subject, advertisement_campaign.id
        )
        assert result is None

    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user
        )

        result = await user_advertisement_service.get_by_id(
            session, auth_subject, advertisement_campaign.id
        )

        assert result is not None
        assert result.id == advertisement_campaign.id


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreate:
    @pytest.mark.auth
    async def test_user(
        self, auth_subject: AuthSubject[User], session: AsyncSession, user: User
    ) -> None:
        advertisement_campaign = await user_advertisement_service.create(
            session,
            auth_subject,
            advertisement_campaign_create=UserAdvertisementCampaignCreate(
                image_url=Url("https://loremflickr.com/g/320/240/cat"),
                text="Test",
                link_url=Url("https://example.com"),
            ),
        )

        assert advertisement_campaign is not None
        assert advertisement_campaign.user_id == user.id


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdate:
    @pytest.mark.auth
    async def test_user(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user
        )

        advertisement_campaign = await user_advertisement_service.update(
            session,
            advertisement_campaign=advertisement_campaign,
            advertisement_campaign_update=UserAdvertisementCampaignUpdate(
                image_url=Url("https://loremflickr.com/g/320/240/kitten"),
            ),
        )

        assert (
            str(advertisement_campaign.image_url)
            == "https://loremflickr.com/g/320/240/kitten"
        )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestEnable:
    @pytest.mark.auth
    async def test_not_granted_benefit(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.ads
        )

        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user
        )
        with pytest.raises(PolarRequestValidationError):
            await user_advertisement_service.enable(
                session=session,
                auth_subject=auth_subject,
                advertisement_campaign=advertisement_campaign,
                advertisement_campaign_enable=UserAdvertisementCampaignEnable(
                    benefit_id=benefit.id
                ),
            )

    @pytest.mark.auth
    async def test_not_ads_benefit(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
    ) -> None:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.custom
        )
        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user
        )
        with pytest.raises(PolarRequestValidationError):
            await user_advertisement_service.enable(
                session=session,
                auth_subject=auth_subject,
                advertisement_campaign=advertisement_campaign,
                advertisement_campaign_enable=UserAdvertisementCampaignEnable(
                    benefit_id=benefit.id
                ),
            )

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.ads
        )
        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user
        )

        user_grant1 = await create_benefit_grant(
            save_fixture, user, benefit, granted=True
        )
        user_grant2 = await create_benefit_grant(
            save_fixture, user, benefit, granted=True
        )
        await create_benefit_grant(save_fixture, user_second, benefit, granted=True)

        grants = await user_advertisement_service.enable(
            session=session,
            auth_subject=auth_subject,
            advertisement_campaign=advertisement_campaign,
            advertisement_campaign_enable=UserAdvertisementCampaignEnable(
                benefit_id=benefit.id
            ),
        )

        assert len(grants) == 2
        assert user_grant1 in grants
        assert user_grant2 in grants
        for grant in grants:
            assert grant.properties["advertisement_campaign_id"] == str(
                advertisement_campaign.id
            )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestDelete:
    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.ads
        )
        advertisement_campaign = await create_advertisement_campaign(
            save_fixture, user=user
        )

        user_grant1 = await create_benefit_grant(
            save_fixture,
            user,
            benefit,
            granted=True,
            properties={"advertisement_campaign_id": str(advertisement_campaign.id)},
        )
        user_grant2 = await create_benefit_grant(
            save_fixture,
            user,
            benefit,
            granted=True,
            properties={"advertisement_campaign_id": str(advertisement_campaign.id)},
        )

        deleted_advertisement_campaign = await user_advertisement_service.delete(
            session, advertisement_campaign=advertisement_campaign
        )

        assert deleted_advertisement_campaign.deleted_at is not None

        for grant in [user_grant1, user_grant2]:
            updated_grant = await session.get(grant.__class__, grant.id)
            assert updated_grant is not None
            assert updated_grant.properties == {}
