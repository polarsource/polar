import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models.advertisement_campaign import AdvertisementCampaign
from polar.models.benefit import Benefit
from polar.models.subscription import Subscription
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_subscription_benefit_grant


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestAdvertisementCampaign:
    @pytest.mark.authenticated
    async def test_create(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
    ) -> None:
        await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        response = await client.post(
            "/api/v1/advertisements/campaigns",
            json={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
                "image_url": "https://example.com/image.png",
                "text": "hello",
                "link_url": "https://example.com/",
            },
        )

        assert response.status_code == 200
        assert response.json()["image_url"] == "https://example.com/image.png"
        assert response.json()["text"] == "hello"
        assert response.json()["link_url"] == "https://example.com/"

    @pytest.mark.authenticated
    async def test_create_no_benefit_granted(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        response = await client.post(
            "/api/v1/advertisements/campaigns",
            json={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
                "image_url": "https://example.com/image.png",
                "text": "hello",
                "link_url": "https://example.com/",
            },
        )

        assert response.status_code == 403

    @pytest.mark.authenticated
    async def test_edit(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
    ) -> None:
        await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        response = await client.post(
            "/api/v1/advertisements/campaigns",
            json={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
                "image_url": "https://example.com/foobar2.jpg",
                "text": "hello",
                "link_url": "https://example.com/",
            },
        )

        assert response.status_code == 200
        assert response.json()["image_url"] == "https://example.com/foobar2.jpg"

        updated = await client.post(
            f"/api/v1/advertisements/campaigns/{response.json()["id"]}",
            json={
                "image_url": "https://example.com/updated.png",
                "text": "hello updated",
                "link_url": "https://example.com/updated.html",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["image_url"] == "https://example.com/updated.png"
        assert updated.json()["text"] == "hello updated"
        assert updated.json()["link_url"] == "https://example.com/updated.html"

    @pytest.mark.authenticated
    async def test_delete(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
    ) -> None:
        await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        response = await client.post(
            "/api/v1/advertisements/campaigns",
            json={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
                "image_url": "https://example.com/foobar.jpg",
                "text": "hello",
                "link_url": "https://example.com/",
            },
        )

        assert response.status_code == 200
        assert response.json()["image_url"] == "https://example.com/foobar.jpg"

        deleted = await client.delete(
            f"/api/v1/advertisements/campaigns/{response.json()["id"]}",
        )
        assert deleted.status_code == 200

        # does not appear in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
            },
        )
        assert searched.status_code == 200
        assert len(searched.json()["items"]) == 0

    @pytest.mark.authenticated
    async def test_search(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
        advertisement_campaign: AdvertisementCampaign,
    ) -> None:
        await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        # appears in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
            },
        )

        assert searched.status_code == 200
        assert len(searched.json()["items"]) == 1

    async def test_search_unauthorized(
        self,
        client: AsyncClient,
        user: User,
        user_second_auth_jwt: str,
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
        advertisement_campaign: AdvertisementCampaign,
    ) -> None:
        await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        # does not appear in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_id": str(subscription.id),
                "subscription_benefit_id": str(benefit_organization.id),
            },
            cookies={settings.AUTH_COOKIE_KEY: user_second_auth_jwt},
        )

        assert searched.status_code == 403

    @pytest.mark.authenticated
    async def test_search_benefit_id(
        self,
        client: AsyncClient,
        user: User,
        user_organization: UserOrganization,  # member
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
        advertisement_campaign: AdvertisementCampaign,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        # appears in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_benefit_id": str(benefit_organization.id),
            },
        )

        assert searched.status_code == 200
        assert len(searched.json()["items"]) == 1

    @pytest.mark.authenticated
    async def test_search_benefit_id_grant_revoked(
        self,
        client: AsyncClient,
        user: User,
        user_organization: UserOrganization,  # member
        subscription: Subscription,
        benefit_organization: Benefit,
        save_fixture: SaveFixture,
        advertisement_campaign: AdvertisementCampaign,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        grant = await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )
        grant.revoked_at = utc_now()
        await save_fixture(grant)

        # appears in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_benefit_id": str(benefit_organization.id),
            },
        )

        assert searched.status_code == 200
        assert len(searched.json()["items"]) == 0

    @pytest.mark.authenticated
    async def test_search_benefit_id_no_member(
        self,
        client: AsyncClient,
        user: User,
        # user_organization: UserOrganization,  # no member
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
        advertisement_campaign: AdvertisementCampaign,
    ) -> None:
        # appears in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_benefit_id": str(benefit_organization.id),
            },
        )

        assert searched.status_code == 401

    async def test_search_benefit_id_unauthorized(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
        advertisement_campaign: AdvertisementCampaign,
        user_second_auth_jwt: str,
    ) -> None:
        # appears in search
        searched = await client.get(
            "/api/v1/advertisements/campaigns/search",
            params={
                "subscription_benefit_id": str(benefit_organization.id),
            },
            cookies={settings.AUTH_COOKIE_KEY: user_second_auth_jwt},
        )

        assert searched.status_code == 401

    async def test_track_view(
        self,
        client: AsyncClient,
        user: User,
        subscription: Subscription,
        user_organization: UserOrganization,  # member
        benefit_organization: Benefit,
        advertisement_campaign: AdvertisementCampaign,
        auth_jwt: str,
        save_fixture: SaveFixture,
    ) -> None:
        user_organization.is_admin = True
        await save_fixture(user_organization)

        grant = await create_subscription_benefit_grant(
            save_fixture,
            user,
            subscription,
            benefit_organization,
        )

        track = await client.post(
            f"/api/v1/advertisements/campaigns/{advertisement_campaign.id}/track_view"
        )

        assert track.status_code == 200
        assert track.json()["image_url"] == advertisement_campaign.image_url

        # check bumped view counter

        got = await client.get(
            f"/api/v1/advertisements/campaigns/{advertisement_campaign.id}",
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )
        assert got.status_code == 200
        assert got.json()["views"] == 1
