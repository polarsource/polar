import pytest
from httpx import AsyncClient

from polar.models.subscription import Subscription


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestAdvertisementCampaign:
    @pytest.mark.authenticated
    async def test_create(
        self, client: AsyncClient, subscription: Subscription
    ) -> None:
        response = await client.post(
            "/api/v1/advertisements/campaigns",
            json={
                "subscription_id": str(subscription.id),
                "format": "rect",
                "image_url": "https://example.com",
                "text": "hello",
                "link_url": "https://example.com/",
            },
        )

        assert response.status_code == 200
        assert response.json()["format"] == "rect"
