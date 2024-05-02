import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
@pytest.mark.auth
async def test_get(client: AsyncClient) -> None:
    response = await client.get("/api/v1/notifications")

    assert response.status_code == 200
