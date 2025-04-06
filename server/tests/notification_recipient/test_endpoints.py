import pytest
from httpx import AsyncClient

from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestCreateNotificationRecipient:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/notifications/recipients/",
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
            "/v1/notifications/recipients/",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_not_writable_organization(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/notifications/recipients/",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        response = await client.post(
            "/v1/notifications/recipients/",
            json={
                "platform": "ios",
                "expo_push_token": "123",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["platform"] == "ios"
        assert json["expo_push_token"] == "123"
