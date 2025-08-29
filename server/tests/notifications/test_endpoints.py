import pytest
from httpx import AsyncClient
from uuid import uuid4

from polar.auth.scope import Scope
from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
@pytest.mark.auth
async def test_get(client: AsyncClient) -> None:
    response = await client.get("/v1/notifications")

    assert response.status_code == 200


@pytest.mark.asyncio
class TestOrganizationNotifications:
    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.web_read, Scope.organizations_read}))
    async def test_get_organization_notifications(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/notifications")

        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert "last_read_notification_id" in data

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.web_write, Scope.organizations_write}))
    async def test_mark_organization_notifications_read(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        # First get notifications to get a notification ID
        response = await client.get(f"/v1/organizations/{organization.id}/notifications")
        assert response.status_code == 200

        # Mark as read (this will work even if there are no notifications)
        response = await client.post(
            f"/v1/organizations/{organization.id}/notifications/read",
            json={"notification_id": str(uuid4())}
        )
        if response.status_code != 200:
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
        assert response.status_code == 200
