import pytest
from httpx import AsyncClient

from polar.models import Organization, UserOrganization
from polar.models.user import User
from polar.notification_recipient.schemas import NotificationRecipientPlatform
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_notification_recipient


@pytest.mark.asyncio
class TestCreateNotificationRecipient:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/notifications/recipients",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        response = await client.post(
            "/v1/notifications/recipients",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        response = await client.post(
            "/v1/notifications/recipients",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["platform"] == "ios"
        assert json["expo_push_token"] == "123"

    @pytest.mark.auth
    async def test_duplicate_same_user(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
    ) -> None:
        existing = await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="123",
            platform=NotificationRecipientPlatform.ios,
        )

        response = await client.post(
            "/v1/notifications/recipients",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["id"] == str(existing.id)

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_reassign_from_other_user(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        user_second: User,
    ) -> None:
        await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="shared_token",
            platform=NotificationRecipientPlatform.ios,
        )

        response = await client.post(
            "/v1/notifications/recipients",
            json={
                "platform": "ios",
                "expo_push_token": "shared_token",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["expo_push_token"] == "shared_token"
        assert json["user_id"] == str(user_second.id)


@pytest.mark.asyncio
class TestListNotificationRecipients:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/notifications/recipients")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user: User,
    ) -> None:
        response = await client.get("/v1/notifications/recipients")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_metadata_filter(
        self, save_fixture: SaveFixture, client: AsyncClient, user: User
    ) -> None:
        await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="123",
            platform=NotificationRecipientPlatform.ios,
        )
        await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="456",
            platform=NotificationRecipientPlatform.ios,
        )

        response = await client.get(
            "/v1/notifications/recipients",
            params={"platform": "ios"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2


@pytest.mark.asyncio
class TestDeleteNotificationRecipient:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.delete("/v1/notifications/recipients/123")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_delete(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
    ) -> None:
        notification_recipient = await create_notification_recipient(
            save_fixture,
            user=user,
            expo_push_token="123",
            platform=NotificationRecipientPlatform.ios,
        )

        response = await client.delete(
            f"/v1/notifications/recipients/{notification_recipient.id}"
        )

        assert response.status_code == 204

        response = await client.get("/v1/notifications/recipients")
        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0
