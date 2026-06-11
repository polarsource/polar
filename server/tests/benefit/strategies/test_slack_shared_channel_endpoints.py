import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestPreviewChannelName:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/benefits/slack/preview-channel-name",
            json={"template": "support-{customer_name}"},
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.benefits_write}))
    async def test_returns_preview(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/benefits/slack/preview-channel-name",
            json={
                "organization_id": str(organization.id),
                "template": "support-{customer_name}-{metadata.tier}",
                "customer_name": "Acme Inc",
                "customer_email": "admin@example.com",
                "customer_metadata": {"tier": "gold"},
            },
        )

        assert response.status_code == 200
        assert response.json() == {"channel_name": "support-acme-inc-gold"}
