import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestCacheControlMiddleware:
    async def test_success_response(self, client: AsyncClient) -> None:
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        assert response.headers["cache-control"] == "private, no-store"

    async def test_error_response(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customers/")
        assert response.status_code == 401
        assert response.headers["cache-control"] == "private, no-store"
