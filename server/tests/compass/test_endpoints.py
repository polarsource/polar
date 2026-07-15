import uuid

import pytest
from httpx import AsyncClient

from polar.models import Organization, UserOrganization
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestAssistantChat:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/compass/assistant",
            json={"organization_id": str(organization.id), "prompt": "hi"},
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_inaccessible_organization(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/compass/assistant",
            json={"organization_id": str(uuid.uuid4()), "prompt": "hi"},
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_compass_disabled_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {}
        await save_fixture(organization)

        response = await client.post(
            "/v1/compass/assistant",
            json={"organization_id": str(organization.id), "prompt": "hi"},
        )

        assert response.status_code == 404
