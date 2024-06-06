import uuid

import pytest
from httpx import AsyncClient

from polar.models import Organization, User
from polar.models.benefit import BenefitAds
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_advertisement_campaign,
    create_benefit,
    create_benefit_grant,
)


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestListAdvertisementCampaigns:
    async def test_not_existing_benefit(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/advertisements/", params={"benefit_id": str(uuid.uuid4())}
        )

        assert response.status_code == 422

    async def test_not_ads_benefit(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        benefit = await create_benefit(save_fixture, organization=organization)
        response = await client.get(
            "/api/v1/advertisements/", params={"benefit_id": str(benefit.id)}
        )

        assert response.status_code == 422

    async def test_no_campaign(
        self, client: AsyncClient, ads_benefit_organization: BenefitAds
    ) -> None:
        response = await client.get(
            "/api/v1/advertisements/",
            params={"benefit_id": str(ads_benefit_organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0
        assert json["items"] == []
        assert json["dimensions"] == [
            ads_benefit_organization.properties["image_width"],
            ads_benefit_organization.properties["image_height"],
        ]

    async def test_with_campaigns(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
        ads_benefit_organization: BenefitAds,
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

        response = await client.get(
            "/api/v1/advertisements/",
            params={"benefit_id": str(ads_benefit_organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2
        assert len(json["items"]) == 2
        assert json["dimensions"] == [
            ads_benefit_organization.properties["image_width"],
            ads_benefit_organization.properties["image_height"],
        ]
