import pytest
from httpx import AsyncClient

from polar.config import settings


@pytest.mark.asyncio
class TestStripeConnectRefresh:
    async def test_missing_return_path(self, client: AsyncClient) -> None:
        response = await client.get("/v1/integrations/stripe/refresh")

        assert response.status_code == 404

    async def test_valid_return_path(self, client: AsyncClient) -> None:
        return_path = "/dashboard/acme/finance/account"
        response = await client.get(
            "/v1/integrations/stripe/refresh", params={"return_path": return_path}
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            return_path
        )

    @pytest.mark.parametrize(
        "return_path",
        [
            "@evil.com",
            "https://evil.com/phish",
            "//evil.com",
            "evil.com",
        ],
    )
    async def test_unsafe_return_path(
        self, client: AsyncClient, return_path: str
    ) -> None:
        response = await client.get(
            "/v1/integrations/stripe/refresh", params={"return_path": return_path}
        )

        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_frontend_url(
            settings.FRONTEND_DEFAULT_RETURN_PATH
        )
